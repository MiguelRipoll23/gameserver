import { DurableObject } from "cloudflare:workers";
import { Logger } from "../../../../core/utils/logger.ts";
import { Container } from "@needle-di/core";
import { WebSocketService } from "../services/websocket-service.ts";
import { WebSocketUser } from "../models/websocket-user.ts";
import { ChatService } from "../services/chat-service.ts";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { NotificationChannelType } from "../enums/notification-channel-enum.ts";
import { AuthenticationUtils } from "../utils/authentication-utils.ts";

/** Minimal identity persisted per connection so hibernation can recover it. */
interface ConnectionRecord {
  readonly publicIp: string;
  readonly authenticated: boolean;
  readonly userId: string;
  readonly name: string;
  readonly hostToken: string | null;
  readonly claims: Record<string, unknown> | null;
}

/**
 * WebSocketDurableObject (this Durable Object) **owns** every WebSocket
 * connection and its per-player state. There is no separate connection
 * registry: the Durable Object talks to the runtime directly —
 *
 *  - `ctx.acceptWebSocket(server, [token])` claims an upgrade for hibernation;
 *  - `ctx.state.getWebSockets(token)` addresses a specific connection (relay,
 *    kick, notify), and `ctx.state.getWebSockets()` fans out to all of them;
 *  - each connection's identity row is persisted under `conn:<token>` and
 *    index under `user:<userId>:<token>` so it survives hibernation/eviction.
 *
 * Stateless Workers reach the single WebSocketDurableObject through the RPC methods below.
 */
export class WebSocketDurableObject extends DurableObject<Env> {
  private static readonly CONN_KEY = "conn:";
  private static readonly USER_KEY = "user:";

  private webSocketService: WebSocketService | null = null;
  private chatService: ChatService | null = null;
  private databaseService: DatabaseService | null = null;
  private servicesInitialized = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  public async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Not found", { status: 404 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // A fresh, unique connection token (32-byte, standard base64). It doubles as
    // the socket's tag so the Durable Object can address or rehydrate this connection at
    // any point (including after hibernation) without holding in-memory state,
    // and peers can trade it for relay addressing.
    const token = AuthenticationUtils.generateToken();
    const publicIp = request.headers.get("CF-Connecting-IP") ?? "unknown";

    this.ctx.acceptWebSocket(server, [token]);
    await this.ctx.storage.put(this.connectionKey(token), this.emptyRecord(publicIp));

    Logger.log(`WebSocket accepted for ${publicIp} (token ${token})`);
    return new Response(null, { status: 101, webSocket: client });
  }

  /** A hibernated socket received data; dispatch into the game protocol. */
  public async webSocketMessage(
    webSocket: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    // The game protocol is binary-only.
    if (typeof message === "string" || !(message instanceof ArrayBuffer)) {
      return;
    }

    this.ensureServices();

    const user = await this.getUserForSocket(webSocket);
    if (!user) {
      return;
    }

    await this.webSocketService!.handleMessageEvent(user, message);
  }

  /** A (possibly hibernated) socket closed. */
  public async webSocketClose(
    webSocket: WebSocket,
    _code: number,
    _reason: string,
    _wasClean: boolean,
  ): Promise<void> {
    await this.handleSocketClosed(webSocket);
  }

  /** A socket errored; treat it as closed. */
  public async webSocketError(webSocket: WebSocket, _error: unknown): Promise<void> {
    await this.handleSocketClosed(webSocket);
  }

  /** Sends an in-game notification to every connected user on a channel. */
  public async pushServerNotification(
    channelId: NotificationChannelType,
    message: string,
  ): Promise<void> {
    this.ensureServices();
    await this.webSocketService!.sendServerNotificationToAll(channelId, message);
  }

  /** Sends an in-game notification to a single connected user. */
  public async pushUserNotification(
    userId: string,
    channelId: NotificationChannelType,
    message: string,
  ): Promise<void> {
    this.ensureServices();
    await this.webSocketService!.sendUserNotification(userId, channelId, message);
  }

  /** Kicks a connected user (used when they are banned). */
  public async kickPlayer(userId: string): Promise<void> {
    this.ensureServices();
    await this.withConnection(() => this.webSocketService!.kickUser(userId));
  }

  /** Asks the chat service to reload its blocked-words cache. */
  public async refreshBlockedWords(): Promise<void> {
    this.ensureServices();
    await this.withConnection(() => this.chatService!.refreshBlockedWordsCache());
  }

  /** Broadcast updated anti-cheat rules to every connected client. */
  public async pushAntiCheatConfig(rulesBinary: ArrayBuffer): Promise<void> {
    this.ensureServices();
    await this.webSocketService!.sendAntiCheatConfigToAll(rulesBinary);
  }

  // ---- Connection access, used by the game/service layer (perf hot paths) ----

  /** Rehydrates the player behind a live socket (used by webSocketMessage). */
  public async getUserForSocket(webSocket: WebSocket): Promise<WebSocketUser | undefined> {
    const tags = this.ctx.getTags(webSocket);
    const token = tags?.[0];
    if (!token) {
      return undefined;
    }

    return this.getByToken(token);
  }

  /** Looks a player up by their connection token (relay fast path). */
  public async getByToken(token: string): Promise<WebSocketUser | undefined> {
    const [webSocket] = this.ctx.getWebSockets(token);
    if (!webSocket) {
      return undefined;
    }

    const record = await this.ctx.storage.get<ConnectionRecord>(
      this.connectionKey(token),
    );
    if (!record) {
      return undefined;
    }

    return this.toUser(record, token, webSocket);
  }

  /** Looks up one connected socket by authenticated user id. */
  public async getById(userId: string): Promise<WebSocketUser | undefined> {
    return (await this.getByIdAll(userId))[0];
  }

  /** Looks up every connected socket for an authenticated user. */
  public async getByIdAll(userId: string): Promise<WebSocketUser[]> {
    const tokens = await this.ctx.storage.list<boolean>({
      prefix: this.userKeyPrefix(userId),
    });
    const users: WebSocketUser[] = [];
    const staleKeys: string[] = [];

    for (const tokenKey of tokens.keys()) {
      const token = tokenKey.slice(this.userKeyPrefix(userId).length);
      const user = await this.getByToken(token);
      if (user) {
        users.push(user);
      } else {
        staleKeys.push(tokenKey, this.connectionKey(token));
      }
    }

    if (staleKeys.length > 0) {
      await this.ctx.storage.delete(staleKeys);
    }

    return users;
  }

  /** All currently connected, authenticated users (broadcast recipients). */
  public async values(): Promise<WebSocketUser[]> {
    const sockets = this.ctx.getWebSockets();
    const socketByToken = new Map<string, WebSocket>();
    const connectionKeys: string[] = [];

    for (const webSocket of sockets) {
      const token = this.ctx.getTags(webSocket)[0];
      if (token === undefined) {
        continue;
      }

      socketByToken.set(token, webSocket);
      connectionKeys.push(this.connectionKey(token));
    }

    const records = await this.ctx.storage.get<ConnectionRecord>(connectionKeys);
    const users: WebSocketUser[] = [];

    for (const [key, record] of records) {
      if (!record?.authenticated) {
        continue;
      }

      const token = key.slice(WebSocketDurableObject.CONN_KEY.length);
      const webSocket = socketByToken.get(token);
      if (webSocket) {
        users.push(this.toUser(record, token, webSocket));
      }
    }

    return users;
  }

  /** Persists identity (and the userId index) once a player authenticates. */
  public async update(user: WebSocketUser): Promise<void> {
    const record: ConnectionRecord = {
      publicIp: user.getPublicIp(),
      authenticated: user.isAuthenticated(),
      userId: user.getId(),
      name: user.getName(),
      hostToken: user.getHostToken(),
      claims: user.getClaims(),
    };

    const writes: Record<string, unknown> = {
      [this.connectionKey(user.getToken())]: record,
    };
    if (user.isAuthenticated()) {
      writes[this.userKey(user.getId(), user.getToken())] = true;
    }

    await this.ctx.storage.put(writes);
  }

  /** Drops a connection's record and user index once it disconnects. */
  public async remove(user: WebSocketUser): Promise<void> {
    await this.ctx.storage.delete([
      this.connectionKey(user.getToken()),
      this.userKey(user.getId(), user.getToken()),
    ]);
  }

  private async handleSocketClosed(webSocket: WebSocket): Promise<void> {
    this.ensureServices();

    const user = await this.getUserForSocket(webSocket);
    if (!user) {
      return;
    }

    await this.webSocketService!.handleCloseEvent(user);
  }

  private toUser(
    record: ConnectionRecord,
    token: string,
    webSocket: WebSocket,
  ): WebSocketUser {
    const user = new WebSocketUser(record.publicIp);
    user.setToken(token);
    user.setId(record.userId);
    user.setName(record.name);
    user.setHostToken(record.hostToken);
    user.setAuthenticated(record.authenticated);
    user.setClaims(record.claims);
    user.setWebSocket(webSocket);
    return user;
  }

  private emptyRecord(publicIp: string): ConnectionRecord {
    return {
      publicIp,
      authenticated: false,
      userId: "unknown",
      name: "unknown",
      hostToken: null,
      claims: null,
    };
  }

  private connectionKey(token: string): string {
    return `${WebSocketDurableObject.CONN_KEY}${token}`;
  }

  private userKeyPrefix(userId: string): string {
    return `${WebSocketDurableObject.USER_KEY}${userId}:`;
  }

  private userKey(userId: string, token: string): string {
    return `${this.userKeyPrefix(userId)}${token}`;
  }

  private withConnection<T>(fn: () => Promise<T>): Promise<T> {
    return this.databaseService!.withConnection(fn);
  }

  private ensureServices(): void {
    if (this.servicesInitialized) {
      return;
    }

    const container = new Container();
    container.bind({ provide: WebSocketDurableObject, useValue: this });

    this.databaseService = container.get(DatabaseService);

    this.webSocketService = container.get(WebSocketService);
    this.chatService = container.get(ChatService);

    this.servicesInitialized = true;
  }
}
