import { DurableObject } from "cloudflare:workers";
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
 * V1WebSocketDurableObject (this Durable Object) **owns** every WebSocket
 * connection and its per-player state. There is no separate connection
 * registry: the hub talks to the runtime directly —
 *
 *  - `ctx.acceptWebSocket(server, [token])` claims an upgrade for hibernation;
 *  - `ctx.state.getWebSockets(token)` addresses a specific connection (relay,
 *    kick, notify), and `ctx.state.getWebSockets()` fans out to all of them;
 *  - each connection's identity row is persisted under `conn:<token>` and
 *    index under `user:<userId>` so it survives hibernation/eviction.
 *
 * Stateless Workers reach the single hub through the RPC methods below.
 */
export class V1WebSocketDurableObject extends DurableObject<Env> {
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
    // the socket's tag so the hub can address or rehydrate this connection at
    // any point (including after hibernation) without holding in-memory state,
    // and peers can trade it for relay addressing.
    const token = AuthenticationUtils.generateToken();
    const publicIp = request.headers.get("CF-Connecting-IP") ?? "unknown";

    this.ctx.acceptWebSocket(server, [token]);
    await this.ctx.storage.put(this.connectionKey(token), this.emptyRecord(publicIp));

    console.log(`WebSocket accepted for ${publicIp} (token ${token})`);
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

  /** Looks a player up by their authenticated user id (RPC kick/notify). */
  public async getById(userId: string): Promise<WebSocketUser | undefined> {
    const token = await this.ctx.storage.get<string>(this.userKey(userId));
    if (!token) {
      return undefined;
    }

    return this.getByToken(token);
  }

  /** All currently connected, authenticated users (broadcast recipients). */
  public async values(): Promise<WebSocketUser[]> {
    const users: WebSocketUser[] = [];

    for (const webSocket of this.ctx.getWebSockets()) {
      const tags = this.ctx.getTags(webSocket);
      const token = tags?.[0];
      if (token === undefined) {
        continue;
      }

      const record = await this.ctx.storage.get<ConnectionRecord>(
        this.connectionKey(token),
      );
      if (record?.authenticated) {
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
      writes[this.userKey(user.getId())] = user.getToken();
    }

    await this.ctx.storage.put(writes);
  }

  /** Drops a connection's record and user index once it disconnects. */
  public async remove(user: WebSocketUser): Promise<void> {
    await this.ctx.storage.delete([
      this.connectionKey(user.getToken()),
      this.userKey(user.getId()),
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
    return `${V1WebSocketDurableObject.CONN_KEY}${token}`;
  }

  private userKey(userId: string): string {
    return `${V1WebSocketDurableObject.USER_KEY}${userId}`;
  }

  private withConnection<T>(fn: () => Promise<T>): Promise<T> {
    return this.databaseService!.withConnection(fn);
  }

  private ensureServices(): void {
    if (this.servicesInitialized) {
      return;
    }

    const container = new Container();
    container.bind({ provide: V1WebSocketDurableObject, useValue: this });

    this.databaseService = container.get(DatabaseService);

    this.webSocketService = container.get(WebSocketService);
    this.chatService = container.get(ChatService);

    this.servicesInitialized = true;
  }
}
