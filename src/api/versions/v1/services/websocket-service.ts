import { decodeBase64, encodeBase64 } from "@std/encoding/base64";
import {
  KICK_USER_EVENT,
  SEND_NOTIFICATION_EVENT,
  SEND_USER_NOTIFICATION_EVENT,
} from "../constants/event-constants.ts";
import { WebSocketType } from "../enums/websocket-enum.ts";
import { inject, injectable } from "@needle-di/core";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { ChatService } from "./chat-service.ts";
import type { WebSocketServer } from "../interfaces/websocket-server-interface.ts";
import { WSMessageReceive } from "hono/ws";
import { WebSocketUser } from "../models/websocket-user.ts";
import { BinaryReader } from "../../../../core/utils/binary-reader-utils.ts";
import { BinaryWriter } from "../../../../core/utils/binary-writer-utils.ts";
import { CommandHandler } from "../decorators/command-handler.ts";
import { WebSocketDispatcherService } from "./websocket-dispatcher-service.ts";
import {
  matchesTable,
  matchUsersTable,
  userSessionsTable,
} from "../../../../db/schema.ts";
import { count, eq } from "drizzle-orm";
import { KVService } from "./kv-service.ts";
import {
  KICK_USER_BROADCAST_CHANNEL,
  NOTIFY_ONLINE_USERS_COUNT_BROADCAST_CHANNEL,
  SEND_TUNNEL_MESSAGE_BROADCAST_CHANNEL,
} from "../constants/broadcast-channel-constants.ts";
import { NotificationChannelType } from "../enums/notification-channel-enum.ts";

@injectable()
export class WebSocketService implements WebSocketServer {
  private notifyOnlineUsersCountBroadcastChannel: BroadcastChannel;
  private sendTunnelMessageBroadcastChannel: BroadcastChannel;
  private kickUserBroadcastChannel: BroadcastChannel;
  private usersById: Map<string, WebSocketUser>;
  private usersByToken: Map<string, WebSocketUser>;

  constructor(
    private kvService = inject(KVService),
    private databaseService = inject(DatabaseService),
    private chatService = inject(ChatService),
    private dispatcher = inject(WebSocketDispatcherService)
  ) {
    this.usersById = new Map();
    this.usersByToken = new Map();
    this.notifyOnlineUsersCountBroadcastChannel = new BroadcastChannel(
      NOTIFY_ONLINE_USERS_COUNT_BROADCAST_CHANNEL
    );
    this.sendTunnelMessageBroadcastChannel = new BroadcastChannel(
      SEND_TUNNEL_MESSAGE_BROADCAST_CHANNEL
    );
    this.kickUserBroadcastChannel = new BroadcastChannel(
      KICK_USER_BROADCAST_CHANNEL
    );
    this.addEventListeners();
    this.addBroadcastChannelListeners();
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

  private addEventListeners(): void {
    addEventListener(SEND_NOTIFICATION_EVENT, (event): void => {
      // deno-lint-ignore no-explicit-any
      const { channelId, message } = (event as CustomEvent<any>).detail;
      this.sendNotificationToUsers(channelId, message);
    });

    addEventListener(SEND_USER_NOTIFICATION_EVENT, (event): void => {
      // deno-lint-ignore no-explicit-any
      const { channelId, userId, message } = (event as CustomEvent<any>).detail;
      this.sendNotificationToUser(channelId, userId, message);
    });

    addEventListener(KICK_USER_EVENT, (event): void => {
      // deno-lint-ignore no-explicit-any
      const { userId } = (event as CustomEvent<any>).detail;
      this.kickUser(userId);
    });
  }

  private addBroadcastChannelListeners(): void {
    this.sendTunnelMessageBroadcastChannel.onmessage =
      this.handleTunnelBroadcastChannelMessage.bind(this);

    this.notifyOnlineUsersCountBroadcastChannel.onmessage =
      this.handleOnlineUsersBroadcastChannelMessage.bind(this);

    this.kickUserBroadcastChannel.onmessage =
      this.handleBannedUserBroadcastChannelMessage.bind(this);
  }

  private handleTunnelBroadcastChannelMessage(event: MessageEvent): void {
    const { destinationToken: destinationToken, payload } = event.data;
    const destinationUser = this.usersByToken.get(destinationToken) ?? null;

    if (destinationUser === null) {
      console.info(`No user found for token ${destinationToken}`);
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

  private handleBannedUserBroadcastChannelMessage(event: MessageEvent): void {
    const { userId } = event.data;
    const user = this.usersById.get(userId);

    if (user) {
      console.log(`Kicking user ${user.getName()} (ID: ${userId}) due to ban`);
      const webSocket = user.getWebSocket();

      if (webSocket && webSocket.readyState === WebSocket.OPEN) {
        webSocket.close(1000, "User has been banned");
      }

      // The handleDisconnection will be called automatically when the WebSocket closes
    } else {
      console.info(
        `User with ID ${userId} not found in current server instance`
      );
    }

    // Send UserBan notification to match host if user is in a match
    this.sendUserBanNotificationToMatchHost(userId);
  }

  private async handleConnection(webSocketUser: WebSocketUser): Promise<void> {
    const userId = webSocketUser.getId();

    if (await this.kvService.isUserBanned(userId)) {
      console.log(
        `Banned user ${webSocketUser.getName()} attempted to connect to server`
      );
      const webSocket = webSocketUser.getWebSocket();

      if (webSocket && webSocket.readyState === WebSocket.OPEN) {
        webSocket.close(1008, "User has been banned");
      }

      return;
    }

    const userToken = webSocketUser.getToken();
    const publicIp = webSocketUser.getPublicIp();

    // Store session in database using upsert (insert or update if user_id exists)
    const db = this.databaseService.get();

    try {
      await db
        .insert(userSessionsTable)
        .values({
          userId: userId,
          token: userToken,
          publicIp: publicIp,
        })
        .onConflictDoUpdate({
          target: userSessionsTable.userId,
          set: {
            token: userToken,
            publicIp: publicIp,
            updatedAt: new Date(),
          },
        });
    } catch (error) {
      console.error(
        `Failed to create/update session for user ${webSocketUser.getName()}:`,
        error
      );
    }

    this.addWebSocketUser(webSocketUser);
    await this.notifyUsersCount();
  }

  private async handleDisconnection(user: WebSocketUser): Promise<void> {
    const userId = user.getId();
    const userName = user.getName();

    console.log(`User ${userName} disconnected from server`);

    try {
      await this.deleteSessionByUserId(userId, userName);
      await this.deleteMatchByUserId(userId, userName);
      await this.deleteUserKeyValueData(userId, userName);
      await this.notifyUsersCount();
    } catch (error) {
      console.error(`Error during disconnection for user ${userName}:`, error);
    } finally {
      this.removeWebSocketUser(user);
    }
  }

  private async deleteSessionByUserId(
    userId: string,
    userName: string
  ): Promise<void> {
    const db = this.databaseService.get();
    const deletedSessions = await db
      .delete(userSessionsTable)
      .where(eq(userSessionsTable.userId, userId))
      .returning({ id: userSessionsTable.userId });

    if (deletedSessions.length > 0) {
      console.log(`Deleted session for user ${userName}`);
    }
  }

  private async deleteMatchByUserId(
    userId: string,
    userName: string
  ): Promise<void> {
    const db = this.databaseService.get();
    const deletedMatches = await db
      .delete(matchesTable)
      .where(eq(matchesTable.hostUserId, userId))
      .returning({ id: matchesTable.id });

    if (deletedMatches.length > 0) {
      console.log(`Deleted match hosted by user ${userName}`);
    }
  }

  private async deleteUserKeyValueData(
    userId: string,
    userName: string
  ): Promise<void> {
    const result = await this.kvService.deleteUserTemporaryData(userId);

    if (result.ok) {
      console.log(`Deleted temporary data for user ${userName}`);
    } else {
      console.error(`Failed to delete temporary data for user ${userName}`);
    }
  }

  private addWebSocketUser(user: WebSocketUser): void {
    this.usersById.set(user.getId(), user);
    this.usersByToken.set(user.getToken(), user);
  }

  private removeWebSocketUser(user: WebSocketUser): void {
    this.usersById.delete(user.getId());
    this.usersByToken.delete(user.getToken());
  }

  public getUserById(id: string): WebSocketUser | undefined {
    return this.usersById.get(id);
  }

  public getUserByToken(token: string): WebSocketUser | undefined {
    return this.usersByToken.get(token);
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
    if (!webSocket || webSocket.readyState !== WebSocket.OPEN) {
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
    destinationToken: string,
    payload: ArrayBuffer
  ): void {
    const destinationUser = this.usersByToken.get(destinationToken);

    if (destinationUser) {
      this.sendMessage(destinationUser, payload);
    } else {
      console.log(
        `Token not found locally, broadcasting message...`,
        destinationToken
      );
      this.sendTunnelMessageBroadcastChannel.postMessage({
        destinationToken,
        payload,
      });
    }
  }

  private sendNotificationToUsers(
    channelId: NotificationChannelType,
    text: string
  ): void {
    for (const user of this.usersByToken.values()) {
      const textBytes = new TextEncoder().encode(text);
      const payload = BinaryWriter.build()
        .unsignedInt8(WebSocketType.Notification)
        .unsignedInt8(channelId)
        .bytes(textBytes)
        .toArrayBuffer();

      this.sendMessage(user, payload);
    }
  }

  private sendNotificationToUser(
    channelId: NotificationChannelType,
    userId: string,
    text: string
  ): void {
    const user = this.usersById.get(userId);

    if (user) {
      // User is connected to this server instance, send notification directly
      const textBytes = new TextEncoder().encode(text);
      const payload = BinaryWriter.build()
        .unsignedInt8(WebSocketType.Notification)
        .unsignedInt8(channelId)
        .bytes(textBytes)
        .toArrayBuffer();

      this.sendMessage(user, payload);
      console.log(
        `Sent notification to user ${user.getName()} (ID: ${userId})`
      );
    } else {
      // User not found locally - they might be connected to another server instance
      // For now, just log this. In a distributed setup, you'd broadcast to other instances
      console.log(
        `User with ID ${userId} not found in current server instance`
      );
    }
  }

  private async getTotalSessions(): Promise<number> {
    const db = this.databaseService.get();
    const result = await db.select({ count: count() }).from(userSessionsTable);
    return result[0]?.count ?? 0;
  }

  private async notifyUsersCount(): Promise<void> {
    const totalSessions = await this.getTotalSessions();
    const onlinePlayersPayload = BinaryWriter.build()
      .unsignedInt8(WebSocketType.OnlinePlayers)
      .unsignedInt16(totalSessions)
      .toArrayBuffer();

    this.notifyOnlineUsersCountBroadcastChannel.postMessage({
      payload: onlinePlayersPayload,
    });

    for (const user of this.usersByToken.values()) {
      this.sendMessage(user, onlinePlayersPayload);
    }
  }

  private kickUser(userId: string): void {
    const user = this.usersById.get(userId);

    if (user) {
      // User is connected to this server instance, kick them directly
      const webSocket = user.getWebSocket();

      if (webSocket && webSocket.readyState === WebSocket.OPEN) {
        webSocket.close(1000, "User has been banned");
        console.log(`Kicked user ${user.getName()} due to ban`);
      }
    } else {
      // User not found locally, broadcast to other server instances
      console.log(
        `User with ID ${userId} not found locally, broadcasting kick message to other servers`
      );

      this.kickUserBroadcastChannel.postMessage({ userId });
    }

    // Send UserBan notification to match host if user is in a match
    this.sendUserBanNotificationToMatchHost(userId);
  }

  /**
   * Sends UserBan notification to the hosts of all matches where the banned user is a participant.
   * This method is called immediately after a user is banned/kicked.
   */
  private async sendUserBanNotificationToMatchHost(
    bannedUserId: string
  ): Promise<void> {
    try {
      const db = this.databaseService.get();

      // Find all matches where the banned user is a participant
      const matchUsers = await db
        .select({
          matchId: matchUsersTable.matchId,
        })
        .from(matchUsersTable)
        .where(eq(matchUsersTable.userId, bannedUserId))
        .limit(1);

      if (matchUsers.length === 0) {
        // User is not in any match as a participant
        console.info(
          `Banned user ${bannedUserId} is not a participant in any match`
        );
        return;
      }

      // Get the match where the banned user is a participant
      // A user can only be in one match at a time
      const matchId = matchUsers[0].matchId;
      const matches = await db
        .select({
          matchId: matchesTable.id,
          hostUserId: matchesTable.hostUserId,
        })
        .from(matchesTable)
        .where(eq(matchesTable.id, matchId));

      if (matches.length === 0) {
        console.error(
          `No match found where banned user ${bannedUserId} was a participant`
        );
        return;
      }

      // Send UserBan notification to the match host
      const match = matches[0];
      const hostUserId = match.hostUserId;
      const hostUser = this.usersById.get(hostUserId);

      if (!hostUser) {
        console.info(
          `Match host ${hostUserId} is not connected to this server instance`
        );
        return;
      }

      const bannedUserNetworkId = bannedUserId.replace(/-/g, "");
      const userBanPayload = BinaryWriter.build()
        .unsignedInt8(WebSocketType.UserBan)
        .fixedLengthString(bannedUserNetworkId, 32)
        .toArrayBuffer();

      this.sendMessage(hostUser, userBanPayload);
      console.log(
        `Sent UserBan notification to host ${hostUserId} for banned user ${bannedUserId}`
      );
    } catch (error) {
      console.error(
        `Error sending UserBan notification for user ${bannedUserId}:`,
        error
      );
    }
  }

  @CommandHandler(WebSocketType.PlayerIdentity)
  private handlePlayerIdentityMessage(
    originUser: WebSocketUser,
    binaryReader: BinaryReader
  ): void {
    const destinationTokenBytes = binaryReader.bytes(32);
    const destinationToken = encodeBase64(destinationTokenBytes);

    console.log("Received player identity message for", destinationToken);

    const playerIdentityPayload = BinaryWriter.build()
      .unsignedInt8(WebSocketType.PlayerIdentity)
      .bytes(decodeBase64(originUser.getToken()), 32)
      .fixedLengthString(originUser.getNetworkId(), 32)
      .fixedLengthString(originUser.getName(), 16)
      .toArrayBuffer();

    this.sendMessageToOtherUser(destinationToken, playerIdentityPayload);
  }

  @CommandHandler(WebSocketType.Tunnel)
  private handleTunnelMessage(
    originUser: WebSocketUser,
    binaryReader: BinaryReader
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
      tunnelPayload
    );
  }

  @CommandHandler(WebSocketType.ChatMessage)
  private async handleChatMessage(
    user: WebSocketUser,
    binaryReader: BinaryReader
  ): Promise<void> {
    await this.chatService.sendSignedChatMessage(this, user, binaryReader);
  }
}
