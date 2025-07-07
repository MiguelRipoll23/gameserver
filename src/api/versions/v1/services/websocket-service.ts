import { decodeBase64, encodeBase64 } from "@std/encoding/base64";
import {
  GLOBAL_NOTIFICATION_EVENT,
  USER_NOTIFICATION_EVENT,
} from "../constants/event-constants.ts";
import {
  ONLINE_USERS_CHANNEL,
  ONLINE_USERS_SERVER_TTL,
  TUNNEL_CHANNEL,
} from "../constants/websocket-constants.ts";
import { SessionKV } from "../interfaces/kv/session-kv.ts";
import { WebSocketType } from "../enums/websocket-enum.ts";
import { inject, injectable } from "@needle-di/core";
import { KVService } from "../../../../core/services/kv-service.ts";
import { WSMessageReceive } from "hono/ws";
import { WebSocketUser } from "../models/websocket-user.ts";
import { BinaryReader } from "../../../../core/utils/binary-reader-utils.ts";
import { BinaryWriter } from "../../../../core/utils/binary-writer-utils.ts";

@injectable()
export class WebSocketService {
  private broadcastChannel: BroadcastChannel;
  private onlineUsersChannel: BroadcastChannel;
  private serverId: string;
  private serversUserCount: Map<string, { count: number; timestamp: number }>;
  private users: Map<string, WebSocketUser>;

  constructor(private kvService = inject(KVService)) {
    this.users = new Map();
    this.serverId = crypto.randomUUID();
    this.broadcastChannel = new BroadcastChannel(TUNNEL_CHANNEL);
    this.onlineUsersChannel = new BroadcastChannel(ONLINE_USERS_CHANNEL);
    this.serversUserCount = new Map();
    this.serversUserCount.set(this.serverId, {
      count: 0,
      timestamp: Date.now(),
    });
    setInterval(this.cleanupOldServers.bind(this), ONLINE_USERS_SERVER_TTL);
    this.addBroadcastChannelListeners();
    this.addOnlineUsersChannelListeners();
    this.addEventListeners();
  }

  public getTotalSessions(): number {
    let total = 0;
    for (const data of this.serversUserCount.values()) {
      total += data.count;
    }
    return total;
  }

  public handleOpenEvent(_event: Event, user: WebSocketUser): void {
    this.handleConnection(user);
  }

  public async handleCloseEvent(
    _event: CloseEvent,
    user: WebSocketUser,
  ): Promise<void> {
    await this.handleDisconnection(user);
  }

  public handleMessageEvent(
    event: MessageEvent<WSMessageReceive>,
    user: WebSocketUser,
  ): void {
    if (!(event.data instanceof ArrayBuffer)) return;

    try {
      this.handleMessage(user, event.data);
    } catch (error) {
      console.error(error);
    }
  }

  private addBroadcastChannelListeners(): void {
    this.broadcastChannel.onmessage = this.handleBroadcastChannelMessage.bind(
      this,
    );
  }

  private addOnlineUsersChannelListeners(): void {
    this.onlineUsersChannel.onmessage = this.handleOnlineUsersChannelMessage
      .bind(this);
  }

  private handleBroadcastChannelMessage(event: MessageEvent): void {
    const { destinationToken, payload } = event.data;
    const destinationUser = this.users.get(destinationToken) ?? null;

    if (destinationUser === null) {
      console.info(`No user found for token ${destinationToken}`);
      return;
    }

    this.sendMessage(destinationUser, payload);
  }

  private handleOnlineUsersChannelMessage(event: MessageEvent): void {
    const { serverId, count } = event.data as {
      serverId: string;
      count: number;
    };
    this.serversUserCount.set(serverId, { count, timestamp: Date.now() });
    this.cleanupOldServers();
    this.notifyOnlinePlayers();
  }

  private addEventListeners(): void {
    addEventListener(GLOBAL_NOTIFICATION_EVENT, (event): void => {
      // deno-lint-ignore no-explicit-any
      this.sendNotificationToUsers((event as CustomEvent<any>).detail.message);
    });
    addEventListener(USER_NOTIFICATION_EVENT, (event): void => {
      // deno-lint-ignore no-explicit-any
      const { userId, message } = (event as CustomEvent<any>).detail;
      this.sendNotificationToUser(userId, message);
    });
  }

  private async handleConnection(webSocketUser: WebSocketUser): Promise<void> {
    const userId = webSocketUser.getId();
    const userToken = webSocketUser.getToken();

    const session: SessionKV = {
      token: userToken,
      timestamp: Date.now(),
    };

    await this.kvService.setSession(userId, session);
    this.users.set(userToken, webSocketUser);
    this.updateAndBroadcastOnlineUsers();
  }

  private async handleDisconnection(user: WebSocketUser): Promise<void> {
    const userId = user.getId();
    const userName = user.getName();
    const userToken = user.getToken();

    console.log(`User ${userName} disconnected from server`);

    const result: Deno.KvCommitResult | Deno.KvCommitError = await this
      .kvService.deleteUserTemporaryData(userId);

    if (result.ok) {
      console.log(`Deleted temporary data for user ${userName}`);
      this.users.delete(userToken);
      this.updateAndBroadcastOnlineUsers();
    } else {
      console.error(`Failed to delete temporary data for user ${userName}`);
      user.setWebSocket(null);
    }
  }

  private handleMessage(user: WebSocketUser, arrayBuffer: ArrayBuffer): void {
    const binaryReader = BinaryReader.fromArrayBuffer(arrayBuffer);

    console.debug(
      `%cReceived message from user ${user.getName()}:\n` +
        binaryReader.preview(),
      "color: green;",
    );

    const commandId = binaryReader.unsignedInt8();

    switch (commandId) {
      case WebSocketType.PlayerIdentity: {
        this.handlePlayerIdentityMessage(user, binaryReader);
        break;
      }

      case WebSocketType.Tunnel: {
        this.handleTunnelMessage(user, binaryReader);
        break;
      }

      default:
        console.warn("Received unknown command identifier", commandId);
    }
  }

  public sendMessage(user: WebSocketUser, arrayBuffer: ArrayBuffer): void {
    const webSocket = user.getWebSocket();

    // Check if the WebSocket is null or closed
    if (webSocket === undefined || webSocket?.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      webSocket.send(arrayBuffer);
      console.debug(
        `%cSent message to user ${user.getName()}:\n` +
          BinaryWriter.preview(arrayBuffer),
        "color: purple",
      );
    } catch (error) {
      console.error("Failed to send message to user", user.getName(), error);
    }
  }

  private sendMessageToOtherUser(
    destinationToken: string,
    payload: ArrayBuffer,
  ): void {
    const destinationUser = this.users.get(destinationToken);

    if (destinationUser) {
      this.sendMessage(destinationUser, payload);
    } else {
      console.log(`Token not found, broadcasting message...`, destinationToken);
      this.broadcastChannel.postMessage({ destinationToken, payload });
    }
  }

  private sendNotificationToUsers(text: string): void {
    for (const user of this.users.values()) {
      const textBytes = new TextEncoder().encode(text);
      const payload = BinaryWriter.build()
        .unsignedInt8(WebSocketType.Notification)
        .bytes(textBytes)
        .toArrayBuffer();

      this.sendMessage(user, payload);
    }
  }

  public sendNotificationToUser(userId: string, text: string): void {
    for (const user of this.users.values()) {
      if (user.getId() === userId) {
        const textBytes = new TextEncoder().encode(text);
        const payload = BinaryWriter.build()
          .unsignedInt8(WebSocketType.Notification)
          .bytes(textBytes)
          .toArrayBuffer();

        this.sendMessage(user, payload);
        break;
      }
    }
  }

  private updateAndBroadcastOnlineUsers(): void {
    const count = this.users.size;
    this.serversUserCount.set(this.serverId, { count, timestamp: Date.now() });
    this.cleanupOldServers();
    this.onlineUsersChannel.postMessage({ serverId: this.serverId, count });
  }

  private notifyOnlinePlayers(): void {
    this.cleanupOldServers();
    const total = this.getTotalSessions();
    const payload = BinaryWriter.build()
      .unsignedInt8(WebSocketType.OnlinePlayers)
      .unsignedInt16(total)
      .toArrayBuffer();

    for (const user of this.users.values()) {
      this.sendMessage(user, payload);
    }
  }

  private cleanupOldServers(): void {
    const now = Date.now();
    for (const [serverId, data] of this.serversUserCount.entries()) {
      if (serverId === this.serverId) continue;
      if (now - data.timestamp > ONLINE_USERS_SERVER_TTL) {
        this.serversUserCount.delete(serverId);
      }
    }
  }

  private handlePlayerIdentityMessage(
    originUser: WebSocketUser,
    binaryReader: BinaryReader,
  ): void {
    const destinationTokenBytes = binaryReader.bytes(32);
    const destinationToken = encodeBase64(destinationTokenBytes);

    console.log("Received player identity message for", destinationToken);

    const playerIdentityPayload = BinaryWriter.build()
      .unsignedInt8(WebSocketType.PlayerIdentity)
      .bytes(decodeBase64(originUser.getToken()), 32)
      .fixedLengthString(originUser.getId(), 32)
      .fixedLengthString(originUser.getName(), 16)
      .toArrayBuffer();

    this.sendMessageToOtherUser(destinationToken, playerIdentityPayload);
  }

  private handleTunnelMessage(
    originUser: WebSocketUser,
    binaryReader: BinaryReader,
  ): void {
    const destinationTokenBytes = binaryReader.bytes(32);
    const dataBytes = binaryReader.bytesAsUint8Array();

    const tunnelPayload = BinaryWriter.build()
      .unsignedInt8(WebSocketType.Tunnel)
      .bytes(decodeBase64(originUser.getToken()), 32)
      .bytes(dataBytes)
      .toArrayBuffer();

    this.sendMessageToOtherUser(
      encodeBase64(destinationTokenBytes),
      tunnelPayload,
    );
  }
}
