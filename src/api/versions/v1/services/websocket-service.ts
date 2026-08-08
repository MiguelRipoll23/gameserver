import { Base64Utils } from "../../../../core/utils/base64-utils.ts";
import { WebSocketType } from "../enums/websocket-enum.ts";
import { inject, injectable } from "@needle-di/core";
import { ChatService } from "./chat-service.ts";
import type { WebSocketServer } from "../interfaces/websocket-server-interface.ts";
import { WebSocketUser } from "../models/websocket-user.ts";
import { BinaryReader } from "../../../../core/utils/binary-reader-utils.ts";
import { BinaryWriter } from "../../../../core/utils/binary-writer-utils.ts";
import {
  buildAntiCheatPayload,
  buildAuthenticationResponsePayload,
  buildNotificationPayload,
  buildOnlinePlayersPayload,
  buildPlayerKickedPayload,
  buildPlayerRelayPayload,
} from "../models/websocket-payloads.ts";
import { CommandHandler } from "../decorators/command-handler.ts";
import { WebSocketDispatcherService } from "./websocket-dispatcher-service.ts";
import { JWTService } from "../../../../core/services/jwt-service.ts";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { RefreshTokensService } from "./refresh-tokens-service.ts";
import { UserEncryptionKeysService } from "./user-encryption-keys-service.ts";
import { UserModerationService } from "./user-moderation-service.ts";
import { WebSocketDurableObject } from "../durable-objects/websocket-durable-object.ts";
import { NotificationChannelType } from "../enums/notification-channel-enum.ts";
import { MatchesService } from "./matches-service.ts";
import { SessionsService } from "./sessions-service.ts";
import { BroadcastCommandType } from "../enums/broadcast-command-enum.ts";
import { UserSignatureService } from "./user-signature-service.ts";
import { AuthenticationRejectedError } from "../models/authentication-rejected-error.ts";

@injectable()
export class WebSocketService implements WebSocketServer {
  constructor(
    private jwtService = inject(JWTService),
    private userModerationService = inject(UserModerationService),
    private refreshTokensService = inject(RefreshTokensService),
    private userEncryptionKeysService = inject(UserEncryptionKeysService),
    private sessionsService = inject(SessionsService),
    private userSignatureService = inject(UserSignatureService),
    private matchesService = inject(MatchesService),
    private chatService = inject(ChatService),
    private dispatcher = inject(WebSocketDispatcherService),
    private webSocketDurableObject = inject(WebSocketDurableObject),
    private databaseService = inject(DatabaseService),
  ) {
    this.dispatcher.registerCommandHandlers(this);
  }

  public handleOpenEvent(user: WebSocketUser): void {
    console.debug(
      `Unauthenticated WebSocket connection from ${user.getPublicIp()}`,
    );
  }

  public async handleCloseEvent(user: WebSocketUser): Promise<void> {
    await this.handleDisconnection(user);
  }

  public async handleMessageEvent(
    user: WebSocketUser,
    data: ArrayBuffer,
  ): Promise<void> {
    if (!(data instanceof ArrayBuffer)) return;

    try {
      await this.handleMessage(user, data);
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
      console.error(
        "Failed to send message to user",
        user.getName(),
        error,
      );
    }
  }

  private async withUserById(
    userId: string,
    command: BroadcastCommandType,
    cb: (user: WebSocketUser) => void,
  ): Promise<boolean> {
    const users = await this.webSocketDurableObject.getByIdAll(userId);

    if (users.length === 0) {
      console.debug(
        `Ignoring ${command} command for user ${userId} because user is not present on this instance`,
      );
      return false;
    }

    for (const user of users) {
      cb(user);
    }
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
      await this.webSocketDurableObject.remove(user);
      return;
    }

    const userId = user.getId();
    const userName = user.getName();

    console.log(`User ${userName} disconnected from server`);

    try {
      await this.databaseService.withConnection(async () => {
        try {
          await this.sessionsService.deleteByUserId(userId, userName);
          await this.deleteUserTemporaryData(userId, userName);
          await this.matchesService.deleteIfExists(userId, userName);
        } catch (error) {
          console.error(
            `Error during disconnection for user ${userName}:`,
            error,
          );
        }
      });
    } finally {
      // Always remove the socket, even if database cleanup fails, so the live
      // connection count cannot remain stale after a disconnect.
      try {
        await this.webSocketDurableObject.remove(user);
      } finally {
        await this.getAndSendOnlinePlayers();
      }
    }
  }

  private async deleteUserTemporaryData(
    userId: string,
    userName: string,
  ): Promise<void> {
    try {
      await this.refreshTokensService.incrementVersion(userId);
      await this.userEncryptionKeysService.delete(userId);
      console.log(`Deleted temporary data for user ${userName}`);
    } catch (error) {
      console.error(
        `Failed to delete temporary data for user ${userName}:`,
        error,
      );
    }
  }

  private async handleMessage(
    user: WebSocketUser,
    arrayBuffer: ArrayBuffer,
  ): Promise<void> {
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
        `Rejected command ${
          WebSocketType[commandId]
        } from unauthenticated user ${user.getPublicIp()}`,
      );
      return;
    }

    await this.dispatcher.dispatchCommand(user, commandId, binaryReader);
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

  private async handleAuthentication(user: WebSocketUser): Promise<void> {
    if (await this.userModerationService.isBanned(user.getId())) {
      this.closeConnection(user, 1008, "User has been banned");
      throw new AuthenticationRejectedError(
        `Banned user ${user.getName()} attempted to connect to server`,
      );
    }

    await this.sessionsService.create(
      user.getId(),
      user.getName(),
      user.getToken(),
      user.getPublicIp(),
    );

    // Persist the now-authenticated identity so it survives hub hibernation.
    await this.webSocketDurableObject.update(user);
  }

  private async sendPlayerRelayToToken(
    destinationToken: string,
    payload: ArrayBuffer,
  ): Promise<void> {
    const destinationUser = await this.webSocketDurableObject.getByToken(destinationToken);

    if (!destinationUser) {
      console.debug(
        `Ignoring player relay: destination token is not connected to the hub`,
      );
      return;
    }

    this.sendMessage(destinationUser, payload);
  }

  private async getAndSendOnlinePlayers(): Promise<void> {
    // The Durable Object is the source of truth for currently connected players.
    // Database sessions can lag or be scoped differently from live WebSockets.
    const users = await this.webSocketDurableObject.values();
    const payload = buildOnlinePlayersPayload(users.length);

    for (const user of users) {
      this.sendMessage(user, payload);
    }
  }

  private async sendNotificationToUsers(
    channelId: NotificationChannelType,
    text: string,
  ): Promise<void> {
    const payload = buildNotificationPayload(channelId, text);

    for (const user of await this.webSocketDurableObject.values()) {
      this.sendMessage(user, payload);
    }

    console.log(
      `Sent notification to all users on channel ${
        NotificationChannelType[channelId]
      }`,
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
      `Sent notification to user ${user.getName()} on channel ${
        NotificationChannelType[channelId]
      }`,
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
      hostUserId = await this.matchesService.getMatchHostIdByUserId(
        bannedUserId,
      );
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

  private async sendPlayerKickedNotificationToHost(
    hostUserId: string,
    bannedUserId: string,
  ): Promise<void> {
    const bannedUserNetworkId = bannedUserId.replace(/-/g, "");

    await this.sendPlayerKickedNotificationToHostWithNetworkId(
      hostUserId,
      bannedUserNetworkId,
    );
  }

  private async sendPlayerKickedNotificationToHostWithNetworkId(
    hostUserId: string,
    bannedUserNetworkId: string,
  ): Promise<void> {
    const [hostUser] = await this.webSocketDurableObject.getByIdAll(hostUserId);

    if (!hostUser) {
      console.debug(
        `Host ${hostUserId} is not connected to the hub; skipping user kicked notification`,
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
    await this.databaseService.withConnection(async () => {
      if (originUser.isAuthenticated()) {
        console.info("Duplicate authentication received; ignoring");
        return;
      }

      const accessToken = binaryReader.variableLengthString();

      try {
        const payload = await this.jwtService.verify(accessToken);
        this.applyIdentity(originUser, payload);

        await this.handleAuthentication(originUser);
        await this.sendAuthenticationResponse(originUser);
      } catch (error) {
        if (error instanceof AuthenticationRejectedError) {
          console.info(error.message);
        } else {
          console.error(
            "Authentication failed:",
            error,
          );
        }
        await this.webSocketDurableObject.remove(originUser);
        this.closeConnection(originUser, 1008, "Authentication failed");
        return;
      }

      // Not part of the auth contract — failure here shouldn't fail auth
      await this.notifyOnlineCount();
    });
  }

  private applyIdentity(
    user: WebSocketUser,
    payload: Record<string, unknown>,
  ): void {
    user.setId(payload.sub as string);
    user.setName(payload.name as string);
    user.setClaims(payload);
    user.setAuthenticated(true);
  }

  private async sendAuthenticationResponse(
    user: WebSocketUser,
  ): Promise<void> {
    const userSignature = await this.userSignatureService.get(
      user.getToken(),
      user.getNetworkId(),
      user.getName(),
    );

    const payload = buildAuthenticationResponsePayload(userSignature);
    this.sendMessage(user, payload);
  }

  private notifyOnlineCount(): Promise<void> {
    return this.getAndSendOnlinePlayers().catch((error) => {
      console.error(
        "Failed to notify users count after authentication:",
        error,
      );
    });
  }

  @CommandHandler(WebSocketType.PlayerRelay)
  private handlePlayerRelay(
    originUser: WebSocketUser,
    binaryReader: BinaryReader,
  ): void {
    const destinationTokenBytes = binaryReader.bytes(32);
    const dataBytes = binaryReader.bytesAsUint8Array();
    const tunnelPayload = buildPlayerRelayPayload(
      Base64Utils.decodeStandardBase64(originUser.getToken()),
      dataBytes,
    );

    this.sendPlayerRelayToToken(
      Base64Utils.encodeStandardBase64(destinationTokenBytes),
      tunnelPayload,
    );
  }

  @CommandHandler(WebSocketType.ChatMessage)
  private async handleChatMessage(
    user: WebSocketUser,
    binaryReader: BinaryReader,
  ): Promise<void> {
    await this.databaseService.withConnection(() =>
      this.chatService.sendSignedChatMessage(this, user, binaryReader)
    );
  }

  ///** Sends an in-game notification to every connected user on a channel. */
  public async sendServerNotificationToAll(
    channelId: NotificationChannelType,
    message: string,
  ): Promise<void> {
    await this.sendNotificationToUsers(channelId, message);
  }

  ///** Sends an in-game notification to a single connected user. */
  public async sendUserNotification(
    userId: string,
    channelId: NotificationChannelType,
    message: string,
  ): Promise<boolean> {
    return await this.withUserById(
      userId,
      BroadcastCommandType.PlayerNotification,
      (user) => {
        this.sendNotificationToResolvedUser(user, channelId, message);
      },
    );
  }

  /** Kicks a connected user, e.g. after they are banned. */
  public async kickUser(userId: string): Promise<boolean> {
    const users = await this.webSocketDurableObject.getByIdAll(userId);

    if (users.length === 0) {
      console.debug(
        `Ignoring KickPlayer command for user ${userId} because user is not present on this instance`,
      );
      return false;
    }

    // Awaited inside the caller's withConnection scope so the follow-up
    // match-host lookup uses the same request-scoped connection.
    for (const user of users) {
      await this.kickResolvedUser(user);
    }
    return true;
  }

  /** Broadcast an anti-cheat configuration update to all connected clients. */
  public async sendAntiCheatConfigToAll(
    rulesBinary: ArrayBuffer,
  ): Promise<void> {
    const payload = buildAntiCheatPayload(rulesBinary);

    for (const user of await this.webSocketDurableObject.values()) {
      this.sendMessage(user, payload);
    }

    console.log("Sent anti-cheat configuration to all connected users");
  }
}
