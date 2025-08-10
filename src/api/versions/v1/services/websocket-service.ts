import { decodeBase64, encodeBase64 } from "@std/encoding/base64";
import { NOTIFICATION_EVENT } from "../constants/event-constants.ts";
import {
  ONLINE_USERS_CHANNEL,
  TUNNEL_CHANNEL,
} from "../constants/websocket-constants.ts";
import { WebSocketType } from "../enums/websocket-enum.ts";
import { inject, injectable } from "@needle-di/core";
import { KVService } from "../../../../core/services/kv-service.ts";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { MatchPlayersService } from "./match-players-service.ts";
import { ChatService } from "./chat-service.ts";
import type { WebSocketServer } from "../interfaces/websocket-server-interface.ts";
import { WSMessageReceive } from "hono/ws";
import { WebSocketUser } from "../models/websocket-user.ts";
import { BinaryReader } from "../../../../core/utils/binary-reader-utils.ts";
import { BinaryWriter } from "../../../../core/utils/binary-writer-utils.ts";
import { CommandHandler } from "../decorators/command-handler.ts";
import { WebSocketDispatcherService } from "./websocket-dispatcher-service.ts";
import { userSessionsTable } from "../../../../db/schema.ts";
import { eq } from "drizzle-orm";

@injectable()
export class WebSocketService implements WebSocketServer {
  private tunnelBroadcastChannel: BroadcastChannel;
  private onlineUsersBroadcastChannel: BroadcastChannel;
  private usersById: Map<string, WebSocketUser>;
  private usersBySessionId: Map<string, WebSocketUser>;

  constructor(
    private kvService = inject(KVService),
    private databaseService = inject(DatabaseService),
    private matchPlayersService = inject(MatchPlayersService),
    private chatService = inject(ChatService),
    private dispatcher = inject(WebSocketDispatcherService)
  ) {
    this.usersById = new Map();
    this.usersBySessionId = new Map();
    this.tunnelBroadcastChannel = new BroadcastChannel(TUNNEL_CHANNEL);
    this.onlineUsersBroadcastChannel = new BroadcastChannel(
      ONLINE_USERS_CHANNEL
    );
    this.addBroadcastChannelListeners();
    this.addEventListeners();
    this.dispatcher.registerCommandHandlers(this);
  }

  public handleOpenEvent(_event: Event, user: WebSocketUser): void {
    this.handleConnection(user);
  }

  public async handleCloseEvent(
    _event: CloseEvent,
    user: WebSocketUser
  ): Promise<void> {
    await this.handleDisconnection(user);
  }

  public handleMessageEvent(
    event: MessageEvent<WSMessageReceive>,
    user: WebSocketUser
  ): void {
    if (!(event.data instanceof ArrayBuffer)) return;

    try {
      this.handleMessage(user, event.data);
    } catch (error) {
      console.error(error);
    }
  }

  private addBroadcastChannelListeners(): void {
    this.tunnelBroadcastChannel.onmessage =
      this.handleTunnelBroadcastChannelMessage.bind(this);

    this.onlineUsersBroadcastChannel.onmessage =
      this.handleOnlineUsersBroadcastChannelMessage.bind(this);
  }

  private handleTunnelBroadcastChannelMessage(event: MessageEvent): void {
    const { destinationSessionId: destinationSessionId, payload } = event.data;
    const destinationUser =
      this.usersBySessionId.get(destinationSessionId) ?? null;

    if (destinationUser === null) {
      console.info(`No user found for session id ${destinationSessionId}`);
      return;
    }

    this.sendMessage(destinationUser, payload);
  }

  private handleOnlineUsersBroadcastChannelMessage(event: MessageEvent): void {
    const { payload } = event.data;

    for (const user of this.usersById.values()) {
      this.sendMessage(user, payload);
    }
  }

  private addEventListeners(): void {
    addEventListener(NOTIFICATION_EVENT, (event): void => {
      // deno-lint-ignore no-explicit-any
      this.sendNotificationToUsers((event as CustomEvent<any>).detail.message);
    });
  }

  private async handleConnection(webSocketUser: WebSocketUser): Promise<void> {
    const userId = webSocketUser.getId();
    const userSessionId = webSocketUser.getSessionId();
    const publicIp = webSocketUser.getPublicIp();

    // Store session in database using upsert (insert or update if user_id exists)
    const db = this.databaseService.get();

    try {
      await db
        .insert(userSessionsTable)
        .values({
          id: userSessionId,
          userId: userId,
          publicIp: publicIp,
        })
        .onConflictDoUpdate({
          target: userSessionsTable.userId,
          set: {
            id: userSessionId,
            publicIp: publicIp,
            createdAt: new Date(),
          },
        });
    } catch (error) {
      console.error(
        `Failed to create/update session for user ${webSocketUser.getName()}:`,
        error
      );
    }

    this.addWebSocketUser(webSocketUser);
    this.notifyUsersCount();
  }

  private async handleDisconnection(user: WebSocketUser): Promise<void> {
    const userId = user.getId();
    const userName = user.getName();
    const userSessionId = user.getSessionId();

    console.log(`User ${userName} disconnected from server`);

    try {
      const db = this.databaseService.get();

      // Delete user session from database
      await db
        .delete(userSessionsTable)
        .where(eq(userSessionsTable.id, userSessionId));

      // Clear temporary KV data (keys, matches)
      const result = await this.kvService.deleteUserTemporaryData(userId);

      if (result.ok) {
        console.log(`Deleted temporary data for user ${userName}`);
        this.removeWebSocketUser(user);
        this.matchPlayersService.deleteBySessionId(userSessionId);
      } else {
        console.error(`Failed to delete temporary data for user ${userName}`);
        user.setWebSocket(null);
      }

      this.notifyUsersCount();
    } catch (error) {
      console.error(`Error during disconnection for user ${userName}:`, error);
      user.setWebSocket(null);
    }
  }

  private addWebSocketUser(user: WebSocketUser): void {
    this.usersById.set(user.getId(), user);
    this.usersBySessionId.set(user.getSessionId(), user);
  }

  private removeWebSocketUser(user: WebSocketUser): void {
    this.usersById.delete(user.getId());
    this.usersBySessionId.delete(user.getSessionId());
  }

  public getUserById(id: string): WebSocketUser | undefined {
    return this.usersById.get(id);
  }

  public getUserBySessionId(sessionId: string): WebSocketUser | undefined {
    return this.usersBySessionId.get(sessionId);
  }

  private handleMessage(user: WebSocketUser, arrayBuffer: ArrayBuffer): void {
    const binaryReader = BinaryReader.fromArrayBuffer(arrayBuffer);

    console.debug(
      `%cReceived message from user ${user.getName()}:\n` +
        binaryReader.preview(),
      "color: green;"
    );

    const commandId = binaryReader.unsignedInt8();

    this.dispatcher.dispatchCommand(user, commandId, binaryReader);
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
        "color: purple"
      );
    } catch (error) {
      console.error("Failed to send message to user", user.getName(), error);
    }
  }

  private sendMessageToOtherUser(
    destinationSessionId: string,
    payload: ArrayBuffer
  ): void {
    const destinationUser = this.usersBySessionId.get(destinationSessionId);

    if (destinationUser) {
      this.sendMessage(destinationUser, payload);
    } else {
      console.log(
        `Session id not found, broadcasting message...`,
        destinationSessionId
      );
      this.tunnelBroadcastChannel.postMessage({
        destinationSessionId,
        payload,
      });
    }
  }

  private sendNotificationToUsers(text: string): void {
    for (const user of this.usersBySessionId.values()) {
      const textBytes = new TextEncoder().encode(text);
      const payload = BinaryWriter.build()
        .unsignedInt8(WebSocketType.Notification)
        .bytes(textBytes)
        .toArrayBuffer();

      this.sendMessage(user, payload);
    }
  }

  private async notifyUsersCount(): Promise<void> {
    const totalSessions = await this.getTotalSessions();

    this.sendOnlineUsersCountToUsers(totalSessions);
    this.sendOnlineUsersCountToServers(totalSessions);
  }

  private async getTotalSessions(): Promise<number> {
    const db = this.databaseService.get();
    return await db.$count(userSessionsTable);
  }

  private sendOnlineUsersCountToServers(totalSessions: number): void {
    const payload = BinaryWriter.build()
      .unsignedInt8(WebSocketType.OnlinePlayers)
      .unsignedInt16(totalSessions)
      .toArrayBuffer();

    this.tunnelBroadcastChannel.postMessage({ payload });
  }

  private sendOnlineUsersCountToUsers(totalSessions: number) {
    const payload = BinaryWriter.build()
      .unsignedInt8(WebSocketType.OnlinePlayers)
      .unsignedInt16(totalSessions)
      .toArrayBuffer();

    for (const user of this.usersBySessionId.values()) {
      this.sendMessage(user, payload);
    }
  }

  @CommandHandler(WebSocketType.PlayerIdentity)
  private handlePlayerIdentityMessage(
    originUser: WebSocketUser,
    binaryReader: BinaryReader
  ): void {
    const destinationSessionIdBytes = binaryReader.bytes(32);
    const destinationSessionId = encodeBase64(destinationSessionIdBytes);

    console.log("Received player identity message for", destinationSessionId);

    const playerIdentityPayload = BinaryWriter.build()
      .unsignedInt8(WebSocketType.PlayerIdentity)
      .bytes(decodeBase64(originUser.getSessionId()), 32)
      .fixedLengthString(originUser.getNetworkId(), 32)
      .fixedLengthString(originUser.getName(), 16)
      .toArrayBuffer();

    this.sendMessageToOtherUser(destinationSessionId, playerIdentityPayload);
  }

  @CommandHandler(WebSocketType.Tunnel)
  private handleTunnelMessage(
    originUser: WebSocketUser,
    binaryReader: BinaryReader
  ): void {
    const destinationSessionIdBytes = binaryReader.bytes(32);
    const dataBytes = binaryReader.bytesAsUint8Array();

    const tunnelPayload = BinaryWriter.build()
      .unsignedInt8(WebSocketType.Tunnel)
      .bytes(decodeBase64(originUser.getSessionId()), 32)
      .bytes(dataBytes)
      .toArrayBuffer();

    this.sendMessageToOtherUser(
      encodeBase64(destinationSessionIdBytes),
      tunnelPayload
    );
  }

  @CommandHandler(WebSocketType.MatchPlayer)
  private handleMatchPlayerMessage(
    user: WebSocketUser,
    binaryReader: BinaryReader
  ): void {
    const isConnected = binaryReader.boolean();
    const playerId = binaryReader.fixedLengthString(32);

    const playerUser = this.usersById.get(playerId);
    if (playerUser) {
      playerUser.setHostSessionId(isConnected ? user.getSessionId() : null);
    }

    this.matchPlayersService.handleMatchPlayerMessage(
      user,
      isConnected,
      playerId
    );
  }

  @CommandHandler(WebSocketType.ChatMessage)
  private handleChatMessage(
    user: WebSocketUser,
    binaryReader: BinaryReader
  ): void {
    this.chatService.handleChatMessage(this, user, binaryReader);
  }
}
