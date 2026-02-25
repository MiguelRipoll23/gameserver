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
  buildUserKickedPayload,
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
import { BroadcastCommandType } from "../enums/broadcast-command-enum.ts";

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
      const { userId, channelId, message } = (event as CustomEvent<any>).detail;
      this.sendNotificationToUser(userId, channelId, message, true);
    });

    addEventListener(KICK_USER_EVENT, (event): void => {
      // deno-lint-ignore no-explicit-any
      const { userId } = (event as CustomEvent<any>).detail;
      void this.kickUser(userId, true);
    });
  }

  private registerBroadcastHandlers(): void {
    this.broadcastService.on(
      BroadcastCommandType.OnlineUsersCount,
      this.handleOnlineUsersBroadcastMessage.bind(this),
    );

    this.broadcastService.on(
      BroadcastCommandType.TunnelMessage,
      this.handleTunnelBroadcastMessage.bind(this),
    );

    this.broadcastService.on(
      BroadcastCommandType.UserNotification,
      this.handleUserNotificationBroadcastMessage.bind(this),
    );

    this.broadcastService.on(
      BroadcastCommandType.KickUser,
      this.handleKickUserBroadcastMessage.bind(this),
    );

    this.broadcastService.on(
      BroadcastCommandType.UserKickedNotification,
      this.handleUserKickedNotificationBroadcastMessage.bind(this),
    );
  }

  private handleOnlineUsersBroadcastMessage(
    payloadMessage: { payload: ArrayBuffer },
  ): void {
    const { payload } = payloadMessage;

    for (const user of this.userRegistry.valuesByToken()) {
      this.sendMessage(user, payload);
    }
  }

  private handleTunnelBroadcastMessage(payloadMessage: {
    destinationToken: string;
    payload: ArrayBuffer;
  }): void {
    const { destinationToken, payload } = payloadMessage;

    this.withUserByToken(
      destinationToken,
      BroadcastCommandType.TunnelMessage,
      (user) => this.sendMessage(user, payload),
    );
  }

  private handleUserNotificationBroadcastMessage(
    payloadMessage: {
      userId: string;
      channelId: NotificationChannelType;
      message: string;
    },
  ): void {
    const { userId, channelId, message } = payloadMessage;
    this.withUserById(userId, BroadcastCommandType.UserNotification, () => {
      this.sendNotificationToUser(userId, channelId, message, false);
    });
  }

  private handleKickUserBroadcastMessage(payloadMessage: {
    userId: string;
  }): void {
    const { userId } = payloadMessage;

    this.withUserById(userId, BroadcastCommandType.KickUser, () => {
      void this.kickUser(userId, false);
    });
  }

  private handleUserKickedNotificationBroadcastMessage(
    payloadMessage: {
      hostUserId: string;
      bannedUserNetworkId: string;
    },
  ): void {
    const { hostUserId, bannedUserNetworkId } = payloadMessage;

    this.withUserById(
      hostUserId,
      BroadcastCommandType.UserKickedNotification,
      () => {
        this.sendUserKickedNotificationToHostWithNetworkId(
          hostUserId,
          bannedUserNetworkId,
        );
      },
    );
  }

  private withUserById(
    userId: string,
    command: BroadcastCommandType,
    cb: (user: WebSocketUser) => void,
  ): void {
    const user = this.userRegistry.getById(userId);

    if (!user) {
      console.debug(
        `Ignoring ${command} command for user ${userId} because user is not present on this instance`,
      );
      return;
    }

    cb(user);
  }

  private withUserByToken(
    userToken: string,
    command: BroadcastCommandType,
    cb: (user: WebSocketUser) => void,
  ): void {
    const user = this.userRegistry.getByToken(userToken);

    if (!user) {
      console.debug(
        `Ignoring ${command} command for token ${userToken} because user is not present on this instance`,
      );
      return;
    }

    cb(user);
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
      await this.getAndSendOnlineUsersCount();
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
      this.closeConnection(webSocketUser, 1008, "User has been banned");
      throw new Error(`Banned user ${userName} attempted to connect to server`);
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

  private sendMessageToUserByToken(
    destinationToken: string,
    payload: ArrayBuffer,
  ): void {
    const destinationUser = this.userRegistry.getByToken(destinationToken);

    if (!destinationUser) {
      this.broadcastService.dispatch(BroadcastCommandType.TunnelMessage, {
        destinationToken,
        payload,
      });
      return;
    }

    this.sendMessage(destinationUser, payload);
  }

  private async getAndSendOnlineUsersCount(): Promise<void> {
    const totalSessions = await this.sessionsService.getTotal();
    const onlinePlayersPayload = buildOnlinePlayersPayload(totalSessions);

    // For other instances...
    this.broadcastService.dispatch(BroadcastCommandType.OnlineUsersCount, {
      payload: onlinePlayersPayload,
    });

    // For our users...
    for (const user of this.userRegistry.valuesByToken()) {
      this.sendMessage(user, onlinePlayersPayload);
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

    console.log(
      `Sent notification to all users on channel ${NotificationChannelType[channelId]}`,
    );
  }

  private sendNotificationToUser(
    userId: string,
    channelId: NotificationChannelType,
    text: string,
    mustBroadcast: boolean,
  ): void {
    const user = this.userRegistry.getById(userId);
    const payload = buildNotificationPayload(channelId, text);

    if (!user) {
      if (mustBroadcast) {
        this.broadcastService.dispatch(BroadcastCommandType.UserNotification, {
          userId,
          channelId,
          message: text,
        });
      }

      return;
    }

    this.sendMessage(user, payload);
    console.log(
      `Sent notification to user ${user.getName()} on channel ${NotificationChannelType[channelId]}`,
    );
  }

  private async kickUser(
    userId: string,
    mustBroadcast: boolean,
  ): Promise<void> {
    const user = this.userRegistry.getById(userId);

    if (!user) {
      if (mustBroadcast) {
        this.broadcastService.dispatch(BroadcastCommandType.KickUser, {
          userId,
        });
      }

      return;
    }

    // User is connected to this server instance, kick them directly
    this.closeConnection(user, 1008, "User has been banned");

    // Send user kicked notification to match host if user is in a match
    await this.findHostAndSendUserKickedNotification(userId);
  }

  private async findHostAndSendUserKickedNotification(
    bannedUserId: string,
  ): Promise<void> {
    let hostUserId: string | null = null;

    try {
      hostUserId =
        await this.matchesService.getMatchHostIdByUserId(bannedUserId);
    } catch (error) {
      console.error(
        `Error obtaining match host for banned user ${bannedUserId}:`,
        error,
      );
      return;
    }

    if (!hostUserId) {
      console.info(
        `Banned user ${bannedUserId} is not currently in a match, skipping user kicked notification`,
      );
      return;
    }

    this.sendUserKickedNotificationToHost(hostUserId, bannedUserId);
  }

  private sendUserKickedNotificationToHost(
    hostUserId: string,
    bannedUserId: string,
  ): void {
    const bannedUserNetworkId = bannedUserId.replace(/-/g, "");

    this.sendUserKickedNotificationToHostWithNetworkId(
      hostUserId,
      bannedUserNetworkId,
    );
  }

  private sendUserKickedNotificationToHostWithNetworkId(
    hostUserId: string,
    bannedUserNetworkId: string,
  ): void {
    const hostUser = this.userRegistry.getById(hostUserId);

    if (!hostUser) {
      this.broadcastService.dispatch(
        BroadcastCommandType.UserKickedNotification,
        {
          hostUserId,
          bannedUserNetworkId,
        },
      );
      return;
    }

    const payload = buildUserKickedPayload(bannedUserNetworkId);
    this.sendMessage(hostUser, payload);

    console.log(
      `Sent user kicked to host ${hostUserId} for banned user network id ${bannedUserNetworkId}`,
    );
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
      return;
    }

    // Send ACK for successful authentication
    const authenticationPayload = buildAuthenticationAckPayload(true);

    this.sendMessage(originUser, authenticationPayload);

    // Notify all users about the updated online count after authentication
    try {
      await this.getAndSendOnlineUsersCount();
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

    this.sendMessageToUserByToken(destinationToken, playerIdentityPayload);
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

    this.sendMessageToUserByToken(
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
