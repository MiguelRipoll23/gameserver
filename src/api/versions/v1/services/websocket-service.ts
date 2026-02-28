import { decodeBase64, encodeBase64 } from "@std/encoding/base64";
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
  buildPlayerRelayPayload,
  buildPlayerKickedPayload,
  buildOnlinePlayersPayload,
} from "./websocket-payloads.ts";
import { CommandHandler } from "../decorators/command-handler.ts";
import { EventHandler } from "../decorators/event-handler.ts";
import { WebSocketDispatcherService } from "./websocket-dispatcher-service.ts";
import { JWTService } from "../../../../core/services/jwt-service.ts";
import { KVService } from "./kv-service.ts";
import { EventsService } from "./events-service.ts";
import { WebSocketUserRegistry } from "./websocket-user-registry.ts";
import { NotificationChannelType } from "../enums/notification-channel-enum.ts";
import { OnlinePlayersPayload } from "../types/online-players-payload-type.ts";
import { PlayerIdentityPayload } from "../types/player-identity-payload-type.ts";
import { PlayerRelayPayload } from "../types/player-relay-payload-type.ts";
import { NotificationPayload } from "../types/notification-payload-type.ts";
import { PlayerNotificationPayload } from "../types/player-notification-payload-type.ts";
import { KickPlayerPayload } from "../types/kick-player-payload-type.ts";
import { PlayerKickedNotificationPayload } from "../types/player-kicked-notification-payload-type.ts";
import { MatchesService } from "./matches-service.ts";
import { SessionsService } from "./sessions-service.ts";
import { BroadcastCommandType } from "../enums/broadcast-command-enum.ts";
import { EventDispatchMode } from "../constants/event-constants.ts";

@injectable()
export class WebSocketService implements WebSocketServer {
  constructor(
    private jwtService = inject(JWTService),
    private kvService = inject(KVService),
    private sessionsService = inject(SessionsService),
    private matchesService = inject(MatchesService),
    private chatService = inject(ChatService),
    private dispatcher = inject(WebSocketDispatcherService),
    private eventsService = inject(EventsService),
    private userRegistry = inject(WebSocketUserRegistry),
  ) {
    this.eventsService.registerEventHandlers(this);
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

  private withUserById(
    userId: string,
    command: BroadcastCommandType,
    cb: (user: WebSocketUser) => void,
  ): boolean {
    const user = this.userRegistry.getById(userId);

    if (!user) {
      console.debug(
        `Ignoring ${command} command for user ${userId} because user is not present on this instance`,
      );
      return false;
    }

    cb(user);
    return true;
  }

  private withUserByToken(
    userToken: string,
    command: BroadcastCommandType,
    cb: (user: WebSocketUser) => void,
  ): boolean {
    const user = this.userRegistry.getByToken(userToken);

    if (!user) {
      console.debug(
        `Ignoring ${command} command for token ${userToken} because user is not present on this instance`,
      );
      return false;
    }

    cb(user);
    return true;
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
      await this.getAndSendOnlinePlayers();
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

  private sendPlayerRelayToToken(
    destinationToken: string,
    payload: ArrayBuffer,
  ): void {
    const destinationUser = this.userRegistry.getByToken(destinationToken);

    if (!destinationUser) {
      this.eventsService.dispatch(BroadcastCommandType.PlayerRelay, {
        destinationToken,
        payload,
      });
      return;
    }

    this.sendMessage(destinationUser, payload);
  }

  private async getAndSendOnlinePlayers(): Promise<void> {
    const totalSessions = await this.sessionsService.getTotal();

    // For other instances...
    this.eventsService.dispatch(
      BroadcastCommandType.OnlinePlayers,
      {
        totalSessions,
      },
      EventDispatchMode.LocalAndBroadcast,
    );
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

  private sendNotificationToResolvedUser(
    user: WebSocketUser,
    channelId: NotificationChannelType,
    text: string,
  ): void {
    const payload = buildNotificationPayload(channelId, text);

    this.sendMessage(user, payload);
    console.log(
      `Sent notification to user ${user.getName()} on channel ${NotificationChannelType[channelId]}`,
    );
  }

  private async kickResolvedUser(user: WebSocketUser): Promise<void> {
    // User is connected to this server instance, kick them directly
    this.closeConnection(user, 1008, "User has been banned");

    // Send user kicked notification to match host if user is in a match
    await this.findHostAndSendPlayerKickedNotification(user.getId());
  }

  private async findHostAndSendPlayerKickedNotification(
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

    this.sendPlayerKickedNotificationToHost(hostUserId, bannedUserId);
  }

  private sendPlayerKickedNotificationToHost(
    hostUserId: string,
    bannedUserId: string,
  ): void {
    const bannedUserNetworkId = bannedUserId.replace(/-/g, "");

    this.sendPlayerKickedNotificationToHostWithNetworkId(
      hostUserId,
      bannedUserNetworkId,
    );
  }

  private sendPlayerKickedNotificationToHostWithNetworkId(
    hostUserId: string,
    bannedUserNetworkId: string,
  ): void {
    const hostUser = this.userRegistry.getById(hostUserId);

    if (!hostUser) {
      this.eventsService.dispatch(
        BroadcastCommandType.PlayerKickedNotification,
        {
          hostUserId,
          bannedUserNetworkId,
        },
      );
      return;
    }

    this.sendPlayerKickedNotificationToResolvedHost(
      hostUser,
      hostUserId,
      bannedUserNetworkId,
    );
  }

  private sendPlayerKickedNotificationToResolvedHost(
    hostUser: WebSocketUser,
    hostUserId: string,
    bannedUserNetworkId: string,
  ): void {
    const payload = buildPlayerKickedPayload(bannedUserNetworkId);
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
      await this.getAndSendOnlinePlayers();
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

    const originTokenBytes = decodeBase64(originUser.getToken());
    const originNetworkId = originUser.getNetworkId();
    const originName = originUser.getName();

    this.eventsService.dispatch(
      BroadcastCommandType.PlayerIdentity,
      {
        destinationToken,
        originTokenBytes,
        originNetworkId,
        originName,
      },
      EventDispatchMode.LocalAndBroadcast,
    );
  }

  @CommandHandler(WebSocketType.PlayerRelay)
  private handlePlayerRelay(
    originUser: WebSocketUser,
    binaryReader: BinaryReader,
  ): void {
    const destinationTokenBytes = binaryReader.bytes(32);
    const dataBytes = binaryReader.bytesAsUint8Array();
    const tunnelPayload = buildPlayerRelayPayload(
      decodeBase64(originUser.getToken()),
      dataBytes,
    );

    this.sendPlayerRelayToToken(
      encodeBase64(destinationTokenBytes),
      tunnelPayload,
    );
  }

  @EventHandler(BroadcastCommandType.OnlinePlayers)
  private handleOnlinePlayersEvent(
    eventPayload: OnlinePlayersPayload,
  ): boolean {
    const { totalSessions } = eventPayload;
    const payload = buildOnlinePlayersPayload(totalSessions);

    for (const user of this.userRegistry.valuesByToken()) {
      this.sendMessage(user, payload);
    }

    return true;
  }

  @EventHandler(BroadcastCommandType.PlayerIdentity)
  private handlePlayerIdentityEvent(
    eventPayload: PlayerIdentityPayload,
  ): boolean {
    const { destinationToken, originTokenBytes, originNetworkId, originName } =
      eventPayload;
    const payload = buildPlayerIdentityPayload(
      originTokenBytes,
      originNetworkId,
      originName,
    );

    return this.withUserByToken(
      destinationToken,
      BroadcastCommandType.PlayerIdentity,
      (user) => this.sendMessage(user, payload),
    );
  }

  @EventHandler(BroadcastCommandType.PlayerRelay)
  private handlePlayerRelayEvent(eventPayload: PlayerRelayPayload): boolean {
    const { destinationToken, payload } = eventPayload;

    return this.withUserByToken(
      destinationToken,
      BroadcastCommandType.PlayerRelay,
      (user) => this.sendMessage(user, payload),
    );
  }

  @CommandHandler(WebSocketType.ChatMessage)
  private async handleChatMessage(
    user: WebSocketUser,
    binaryReader: BinaryReader,
  ): Promise<void> {
    await this.chatService.sendSignedChatMessage(this, user, binaryReader);
  }

  @EventHandler(BroadcastCommandType.Notification)
  private handleNotificationEvent(eventPayload: NotificationPayload): boolean {
    const { channelId, message } = eventPayload;
    this.sendNotificationToUsers(channelId, message);
    return true;
  }

  @EventHandler(BroadcastCommandType.PlayerNotification)
  private handlePlayerNotificationEvent(
    eventPayload: PlayerNotificationPayload,
  ): boolean {
    const { userId, channelId, message } = eventPayload;

    return this.withUserById(
      userId,
      BroadcastCommandType.PlayerNotification,
      (user) => {
        this.sendNotificationToResolvedUser(user, channelId, message);
      },
    );
  }

  @EventHandler(BroadcastCommandType.KickPlayer)
  private handleKickPlayerEvent(eventPayload: KickPlayerPayload): boolean {
    const { userId } = eventPayload;

    return this.withUserById(
      userId,
      BroadcastCommandType.KickPlayer,
      (user) => {
        void this.kickResolvedUser(user);
      },
    );
  }

  @EventHandler(BroadcastCommandType.PlayerKickedNotification)
  private handlePlayerKickedNotificationEvent(
    eventPayload: PlayerKickedNotificationPayload,
  ): boolean {
    const { hostUserId, bannedUserNetworkId } = eventPayload;

    return this.withUserById(
      hostUserId,
      BroadcastCommandType.PlayerKickedNotification,
      (hostUser) => {
        this.sendPlayerKickedNotificationToResolvedHost(
          hostUser,
          hostUserId,
          bannedUserNetworkId,
        );
      },
    );
  }
}
