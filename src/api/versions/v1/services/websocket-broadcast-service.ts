import {
  KICK_USER_BROADCAST_CHANNEL,
  NOTIFY_ONLINE_USERS_COUNT_BROADCAST_CHANNEL,
  SEND_TUNNEL_MESSAGE_BROADCAST_CHANNEL,
  SEND_USER_BAN_NOTIFICATION_BROADCAST_CHANNEL,
} from "../constants/broadcast-channel-constants.ts";
import { injectable } from "@needle-di/core";

@injectable()
export class WebSocketBroadcastService {
  private notifyOnlineUsersCountBroadcastChannel: BroadcastChannel;
  private sendTunnelMessageBroadcastChannel: BroadcastChannel;
  private kickUserBroadcastChannel: BroadcastChannel;
  private userKickedNotificationBroadcastChannel: BroadcastChannel;

  constructor() {
    this.notifyOnlineUsersCountBroadcastChannel = new BroadcastChannel(
      NOTIFY_ONLINE_USERS_COUNT_BROADCAST_CHANNEL,
    );
    this.sendTunnelMessageBroadcastChannel = new BroadcastChannel(
      SEND_TUNNEL_MESSAGE_BROADCAST_CHANNEL,
    );
    this.kickUserBroadcastChannel = new BroadcastChannel(
      KICK_USER_BROADCAST_CHANNEL,
    );
    this.userKickedNotificationBroadcastChannel = new BroadcastChannel(
      SEND_USER_BAN_NOTIFICATION_BROADCAST_CHANNEL,
    );
  }

  public onTunnelMessage(cb: (event: MessageEvent) => void): void {
    this.sendTunnelMessageBroadcastChannel.onmessage = cb;
  }

  public onOnlineUsersCount(cb: (event: MessageEvent) => void): void {
    this.notifyOnlineUsersCountBroadcastChannel.onmessage = cb;
  }

  public onKickUser(cb: (event: MessageEvent) => void): void {
    this.kickUserBroadcastChannel.onmessage = cb;
  }

  public onUserBanNotification(cb: (event: MessageEvent) => void): void {
    this.userKickedNotificationBroadcastChannel.onmessage = cb;
  }

  public postTunnelMessage(
    destinationToken: string,
    payload: ArrayBuffer,
  ): void {
    this.sendTunnelMessageBroadcastChannel.postMessage({
      destinationToken,
      payload,
    });

    console.log(`Broadcasted tunnel message to token ${destinationToken}`);
  }

  public postOnlineUsersCount(payload: ArrayBuffer): void {
    this.notifyOnlineUsersCountBroadcastChannel.postMessage({ payload });

    console.log(`Broadcasted online users count to other instances`);
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
      `Broadcasted user kicked for host ID ${hostUserId} and banned user network id ${bannedUserNetworkId}`,
    );
  }
}

export default WebSocketBroadcastService;
