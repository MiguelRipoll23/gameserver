import {
  KICK_USER_BROADCAST_CHANNEL,
  ONLINE_USERS_COUNT_BROADCAST_CHANNEL,
  TUNNEL_MESSAGE_BROADCAST_CHANNEL,
  USER_KICKED_NOTIFICATION_BROADCAST_CHANNEL,
  USER_NOTIFICATION_BROADCAST_CHANNEL,
} from "../constants/broadcast-channel-constants.ts";
import { injectable } from "@needle-di/core";
import { NotificationChannelType } from "../enums/notification-channel-enum.ts";

@injectable()
export class WebSocketBroadcastService {
  private onlineUsersCountBroadcastChannel: BroadcastChannel;
  private tunnelMessageBroadcastChannel: BroadcastChannel;
  private userNotificationBroadcastChannel: BroadcastChannel;
  private kickUserBroadcastChannel: BroadcastChannel;
  private userKickedNotificationBroadcastChannel: BroadcastChannel;

  constructor() {
    this.onlineUsersCountBroadcastChannel = new BroadcastChannel(
      ONLINE_USERS_COUNT_BROADCAST_CHANNEL,
    );

    this.tunnelMessageBroadcastChannel = new BroadcastChannel(
      TUNNEL_MESSAGE_BROADCAST_CHANNEL,
    );

    this.userNotificationBroadcastChannel = new BroadcastChannel(
      USER_NOTIFICATION_BROADCAST_CHANNEL,
    );

    this.kickUserBroadcastChannel = new BroadcastChannel(
      KICK_USER_BROADCAST_CHANNEL,
    );

    this.userKickedNotificationBroadcastChannel = new BroadcastChannel(
      USER_KICKED_NOTIFICATION_BROADCAST_CHANNEL,
    );
  }

  public close(): void {
    this.onlineUsersCountBroadcastChannel.close();
    this.tunnelMessageBroadcastChannel.close();
    this.userNotificationBroadcastChannel.close();
    this.kickUserBroadcastChannel.close();
    this.userKickedNotificationBroadcastChannel.close();
  }

  public onOnlineUsersCount(cb: (event: MessageEvent) => void): void {
    this.onlineUsersCountBroadcastChannel.addEventListener("message", cb);
  }

  public onTunnelMessage(cb: (event: MessageEvent) => void): void {
    this.tunnelMessageBroadcastChannel.addEventListener("message", cb);
  }

  public onUserNotification(cb: (event: MessageEvent) => void): void {
    this.userNotificationBroadcastChannel.addEventListener("message", cb);
  }

  public onKickUser(cb: (event: MessageEvent) => void): void {
    this.kickUserBroadcastChannel.addEventListener("message", cb);
  }

  public onUserBanNotification(cb: (event: MessageEvent) => void): void {
    this.userKickedNotificationBroadcastChannel.addEventListener("message", cb);
  }

  public postOnlineUsersCount(payload: ArrayBuffer): void {
    this.onlineUsersCountBroadcastChannel.postMessage({ payload });

    console.log(`Broadcasted online users count to other instances`);
  }

  public postTunnelMessage(
    destinationToken: string,
    payload: ArrayBuffer,
  ): void {
    this.tunnelMessageBroadcastChannel.postMessage({
      destinationToken,
      payload,
    });

    console.log(`Broadcasted tunnel message to token ${destinationToken}`);
  }

  public postUserNotification(
    userId: string,
    channelId: NotificationChannelType,
    message: string,
  ): void {
    this.userNotificationBroadcastChannel.postMessage({
      userId,
      channelId,
      message,
    });

    console.log(
      `Broadcasted user notification to user ${userId} on channel ${NotificationChannelType[channelId]}`,
    );
  }

  public postKickUser(userId: string): void {
    this.kickUserBroadcastChannel.postMessage({ userId });
    console.log(`Broadcasted kick for user ${userId}`);
  }

  public postUserKicked(hostUserId: string, bannedUserNetworkId: string): void {
    this.userKickedNotificationBroadcastChannel.postMessage({
      hostUserId,
      bannedUserNetworkId,
    });

    console.log(
      `Broadcasted user kicked notification for user ${bannedUserNetworkId} to host ${hostUserId}`,
    );
  }
}

export default WebSocketBroadcastService;
