import { decodeBase64, encodeBase64 } from "@std/encoding/base64";
import {
  KICK_USER_EVENT,
  SEND_NOTIFICATION_EVENT,
  SEND_USER_NOTIFICATION_EVENT,
} from "../constants/event-constants.ts";
import { WebSocketType } from "../enums/websocket-enum.ts";
import { inject, injectable } from "@needle-di/core";
import { ChatService } from "./chat-service.ts";
import type { WebSocketServer } from "../interfaces/websocket-server-interface.ts";
import { WSMessageReceive } from "hono/ws";
import { WebSocketUser } from "../models/websocket-user.ts";
import { BinaryReader } from "../../../../core/utils/binary-reader-utils.ts";
import { BinaryWriter } from "../../../../core/utils/binary-writer-utils.ts";
import {
  buildAuthenticationAckPayload,
  buildNotificationPayload,
  buildPlayerIdentityPayload,
  buildTunnelPayload,
  buildUserBanPayload,
  buildOnlinePlayersPayload,
} from "./websocket-payloads.ts";
import { CommandHandler } from "../decorators/command-handler.ts";
import { WebSocketDispatcherService } from "./websocket-dispatcher-service.ts";
import { JWTService } from "../../../../core/services/jwt-service.ts";
import { KVService } from "./kv-service.ts";
import { WebSocketBroadcastService } from "./websocket-broadcast-service.ts";
import { WebSocketUserRegistry } from "./websocket-user-registry.ts";
import { NotificationChannelType } from "../enums/notification-channel-enum.ts";
import { MatchesService } from "./matches-service.ts";
import { SessionsService } from "./sessions-service.ts";

@injectable()
export class WebSocketService implements WebSocketServer {
  constructor(
    private jwtService = inject(JWTService),
    private kvService = inject(KVService),
    private sessionsService = inject(SessionsService),
    private matchesService = inject(MatchesService),
    private chatService = inject(ChatService),
    private dispatcher = inject(WebSocketDispatcherService),
    private broadcastService = inject(WebSocketBroadcastService),
    private userRegistry = inject(WebSocketUserRegistry),
  ) {
    this.addEventListeners();
    this.registerBroadcastHandlers();
    this.dispatcher.registerCommandHandlers(this);
  }

  public handleOpenEvent(_event: Event, user: WebSocketUser): void {
    console.debug(
      `Unauthenticated WebSocket connection from ${user.getPublicIp()}`,
    );
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
      void this.kickUser(userId);
    });
  }

  private registerBroadcastHandlers(): void {
    this.broadcastService.onTunnelMessage(
      this.handleTunnelBroadcastChannelMessage.bind(this),
    );
    this.broadcastService.onOnlineUsersCount(
      this.handleOnlineUsersBroadcastChannelMessage.bind(this),
    );
    this.broadcastService.onKickUser(
      this.handleKickUserBroadcastChannelMessage.bind(this),
    );
    this.broadcastService.onUserBanNotification(
      this.handleUserBanNotificationBroadcastChannelMessage.bind(this),
    );
  }

  private handleTunnelBroadcastChannelMessage(event: MessageEvent): void {
    const { destinationToken: destinationToken, payload } = event.data;
    const destinationUser =
      this.userRegistry.getByToken(destinationToken) ?? null;

    if (destinationUser === null) {
      console.info(`No user found for token ${destinationToken}`);
      return;
    }

    this.sendMessage(destinationUser, payload);
  }

  private handleOnlineUsersBroadcastChannelMessage(event: MessageEvent): void {
    const { payload } = event.data;

    for (const user of this.userRegistry.valuesById()) {
      this.sendMessage(user, payload);
    }
  }

  private handleKickUserBroadcastChannelMessage(event: MessageEvent): void {
    const { userId } = event.data;
    const user = this.userRegistry.getById(userId);

    if (user) {
      console.log(`Kicking user ${user.getName()} (ID: ${userId}) due to ban`);
      this.closeConnection(user, 1008, "User has been banned");
      // The handleDisconnection will be called automatically when the WebSocket closes
    } else {
      console.info(
        `User with ID ${userId} not found in current server instance`,
      );
    }
  }

  private handleUserBanNotificationBroadcastChannelMessage(
    event: MessageEvent,
  ): void {
    const { hostUserId, bannedUserNetworkId } = event.data;
    const hostUser = this.userRegistry.getById(hostUserId);

    if (!hostUser) {
      console.info(
        `Match host ${hostUserId} is not connected to this server instance`,
      );
      return;
    }

    try {
      this.sendUserBanNotificationPayload(hostUser, bannedUserNetworkId);
      console.log(
        `Sent UserBan notification to host ${hostUserId} for banned user (networkId: ${bannedUserNetworkId})`,
      );
    } catch (error) {
      console.error(
        `Error sending UserBan notification to host ${hostUserId}:`,
        error,
      );
    }
  }

  private closeConnection(
    user: WebSocketUser,
    code: number,
    reason: string,
  ): void {
    const webSocket = user.getWebSocket();

    if (!webSocket || webSocket.readyState !== WebSocket.OPEN) {
      return;
    }

    webSocket.close(code, reason);
    console.log(
      `Closed connection for user ${user.getName()} with code ${code}: ${reason}`,
    );
  }

  private async handleDisconnection(user: WebSocketUser): Promise<void> {
    if (!user.isAuthenticated()) {
      console.debug(
        `Unauthenticated WebSocket connection disconnection from ${user.getPublicIp()}`,
      );
      return;
    }

    const userId = user.getId();
    const userName = user.getName();

    console.log(`User ${userName} disconnected from server`);

    try {
      await this.sessionsService.deleteByUserId(userId, userName);
      await this.deleteUserKeyValueData(userId, userName);
      await this.matchesService.deleteIfExists(userId, userName);
      await this.notifyUsersCount();
    } catch (error) {
      console.error(`Error during disconnection for user ${userName}:`, error);
    } finally {
      this.userRegistry.remove(user);
    }
  }

  private async deleteUserKeyValueData(
    userId: string,
    userName: string,
  ): Promise<void> {
    const result = await this.kvService.deleteUserTemporaryData(userId);

    if (result.ok) {
      console.log(`Deleted temporary key/value data for user ${userName}`);
    } else {
      console.error(`Failed to delete key/value data for user ${userName}`);
    }
  }

  public getUserById(id: string): WebSocketUser | undefined {
    return this.userRegistry.getById(id);
  }

  public getUserByToken(token: string): WebSocketUser | undefined {
    return this.userRegistry.getByToken(token);
  }

  private handleMessage(user: WebSocketUser, arrayBuffer: ArrayBuffer): void {
    const binaryReader = BinaryReader.fromArrayBuffer(arrayBuffer);
    const commandId = binaryReader.unsignedInt8();

    if (commandId == WebSocketType.Authentication) {
      console.debug(
        `%cReceived authentication message from ${user.getPublicIp()}`,
        "color: green;",
      );
    } else {
      console.debug(
        `%cReceived message from user ${user.getName()}:\n` +
          binaryReader.preview(),
        "color: green;",
      );
    }

    if (this.rejectWhenUnauthenticated(user, commandId)) {
      console.warn(
        `Rejected command ${WebSocketType[commandId]} from unauthenticated user ${user.getPublicIp()}`,
      );
      return;
    }

    this.dispatcher.dispatchCommand(user, commandId, binaryReader);
  }

  private rejectWhenUnauthenticated(
    user: WebSocketUser,
    commandId: WebSocketType,
  ): boolean {
    if (!user.isAuthenticated() && commandId !== WebSocketType.Authentication) {
      this.closeConnection(user, 1008, "Authentication required");
      return true;
    }

    return false;
  }

  private async handleAuthentication(
    webSocketUser: WebSocketUser,
  ): Promise<void> {
    const userId = webSocketUser.getId();
    const userName = webSocketUser.getName();

    if (await this.kvService.isUserBanned(userId)) {
      console.log(`Banned user ${userName} attempted to connect to server`);
      this.closeConnection(webSocketUser, 1008, "User has been banned");
      return;
    }

    const userToken = webSocketUser.getToken();
    const userPublicIp = webSocketUser.getPublicIp();

    await this.sessionsService.create(
      userId,
      userName,
      userToken,
      userPublicIp,
    );

    this.userRegistry.add(webSocketUser);
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
    const destinationUser = this.userRegistry.getByToken(destinationToken);

    if (destinationUser) {
      this.sendMessage(destinationUser, payload);
    } else {
      console.log(
        `Token not found locally, broadcasting message...`,
        destinationToken,
      );
      this.broadcastService.postTunnelMessage(destinationToken, payload);
    }
  }

  private sendNotificationToUsers(
    channelId: NotificationChannelType,
    text: string,
  ): void {
    const payload = buildNotificationPayload(channelId, text);

    for (const user of this.userRegistry.valuesByToken()) {
      this.sendMessage(user, payload);
    }
  }

  private sendNotificationToUser(
    channelId: NotificationChannelType,
    userId: string,
    text: string,
  ): void {
    const user = this.userRegistry.getById(userId);

    if (user) {
      // User is connected to this server instance, send notification directly
      const payload = buildNotificationPayload(channelId, text);

      this.sendMessage(user, payload);
      console.log(
        `Sent notification to user ${user.getName()} (ID: ${userId})`,
      );
    } else {
      // User not found locally - they might be connected to another server instance
      // For now, just log this. In a distributed setup, you'd broadcast to other instances
      console.log(
        `User with ID ${userId} not found in current server instance`,
      );
    }
  }

  private async notifyUsersCount(): Promise<void> {
    const totalSessions = await this.sessionsService.getTotal();
    const onlinePlayersPayload = buildOnlinePlayersPayload(totalSessions);

    this.broadcastService.postOnlineUsersCount(onlinePlayersPayload);

    for (const user of this.userRegistry.valuesByToken()) {
      this.sendMessage(user, onlinePlayersPayload);
    }
  }

  private async kickUser(userId: string): Promise<void> {
    const user = this.userRegistry.getById(userId);

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
        `User with ID ${userId} not found locally, broadcasting kick message to other servers`,
      );

      this.broadcastService.postKick(userId);
    }

    // Send UserBan notification to match host if user is in a match
    await this.sendUserBanNotificationToMatchHost(userId);
  }

  /**
   * Sends a UserBan notification to the host of a match where the banned user is a participant.
   * This method is called immediately after a user is banned/kicked.
   */
  private async sendUserBanNotificationToMatchHost(
    bannedUserId: string,
  ): Promise<void> {
    try {
      const hostUserId =
        await this.matchesService.getMatchHostIdByUserId(bannedUserId);

      if (!hostUserId) {
        return;
      }

      this.sendUserBanNotificationToHost(hostUserId, bannedUserId);
    } catch (error) {
      console.error(
        `Error sending UserBan notification for user ${bannedUserId}:`,
        error,
      );
    }
  }

  /**
   * Delivers the UserBan notification to the match host.
   * If the host is connected locally, sends directly; otherwise broadcasts to other server instances.
   */
  private sendUserBanNotificationToHost(
    hostUserId: string,
    bannedUserId: string,
  ): void {
    const hostUser = this.userRegistry.getById(hostUserId);
    const bannedUserNetworkId = bannedUserId.replace(/-/g, "");

    if (!hostUser) {
      // Host not found locally, broadcast to other server instances
      this.broadcastUserBanNotification(
        hostUserId,
        bannedUserNetworkId,
        bannedUserId,
      );
      return;
    }

    // Host is connected locally, send directly
    this.sendUserBanNotificationPayload(hostUser, bannedUserNetworkId);
    console.log(
      `Sent UserBan notification to host ${hostUserId} for banned user ${bannedUserId}`,
    );
  }

  /**
   * Broadcasts the UserBan notification to other server instances.
   */
  private broadcastUserBanNotification(
    hostUserId: string,
    bannedUserNetworkId: string,
    bannedUserId: string,
  ): void {
    console.info(
      `Match host ${hostUserId} is not connected to this server instance, broadcasting to other servers`,
    );

    try {
      this.broadcastService.postUserBanNotification(
        hostUserId,
        bannedUserNetworkId,
      );
      console.log(
        `Broadcasted UserBan notification for host ${hostUserId} and banned user ${bannedUserId}`,
      );
    } catch (error) {
      console.error(
        `Failed to broadcast UserBan notification for host ${hostUserId}:`,
        error,
      );
    }
  }

  /**
   * Sends the UserBan notification payload to a specific user.
   */
  private sendUserBanNotificationPayload(
    user: WebSocketUser,
    bannedUserNetworkId: string,
  ): void {
    const userBanPayload = buildUserBanPayload(bannedUserNetworkId);

    this.sendMessage(user, userBanPayload);
  }

  @CommandHandler(WebSocketType.Authentication)
  private async handleAuthenticationMessage(
    originUser: WebSocketUser,
    binaryReader: BinaryReader,
  ): Promise<void> {
    // Prevent repeated authentication attempts
    if (originUser.isAuthenticated()) {
      console.info("Duplicate authentication received; ignoring");
      return;
    }

    const token = binaryReader.variableLengthString();

    try {
      const payload = await this.jwtService.verify(token);

      // Apply identity from JWT
      originUser.setId(payload.sub as string);
      originUser.setName(payload.name as string);
      originUser.setClaims(payload as Record<string, unknown>);
      originUser.setAuthenticated(true);

      await this.handleAuthentication(originUser);
    } catch (error) {
      console.error("Authentication failed:", error);
      this.closeConnection(originUser, 1008, "Authentication failed");
    }

    // Send ACK for successful authentication
    const authenticationPayload = buildAuthenticationAckPayload(true);

    this.sendMessage(originUser, authenticationPayload);

    // Notify all users about the updated online count after authentication
    try {
      await this.notifyUsersCount();
    } catch (error) {
      console.error(
        "Failed to notify users count after authentication:",
        error,
      );
    }
  }

  @CommandHandler(WebSocketType.PlayerIdentity)
  private handlePlayerIdentityMessage(
    originUser: WebSocketUser,
    binaryReader: BinaryReader,
  ): void {
    const destinationTokenBytes = binaryReader.bytes(32);
    const destinationToken = encodeBase64(destinationTokenBytes);

    console.log("Received player identity message for", destinationToken);
    const playerIdentityPayload = buildPlayerIdentityPayload(
      decodeBase64(originUser.getToken()),
      originUser.getNetworkId(),
      originUser.getName(),
    );

    this.sendMessageToOtherUser(destinationToken, playerIdentityPayload);
  }

  @CommandHandler(WebSocketType.Tunnel)
  private handleTunnelMessage(
    originUser: WebSocketUser,
    binaryReader: BinaryReader,
  ): void {
    const destinationTokenBytes = binaryReader.bytes(32);
    const dataBytes = binaryReader.bytesAsUint8Array();
    const tunnelPayload = buildTunnelPayload(
      decodeBase64(originUser.getToken()),
      dataBytes,
    );

    this.sendMessageToOtherUser(
      encodeBase64(destinationTokenBytes),
      tunnelPayload,
    );
  }

  @CommandHandler(WebSocketType.ChatMessage)
  private async handleChatMessage(
    user: WebSocketUser,
    binaryReader: BinaryReader,
  ): Promise<void> {
    await this.chatService.sendSignedChatMessage(this, user, binaryReader);
  }
}
