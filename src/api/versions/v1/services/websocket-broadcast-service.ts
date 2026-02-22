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
  private sendUserBanNotificationBroadcastChannel: BroadcastChannel;

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
    this.sendUserBanNotificationBroadcastChannel = new BroadcastChannel(
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
    this.sendUserBanNotificationBroadcastChannel.onmessage = cb;
  }

  public postTunnelMessage(
    destinationToken: string,
    payload: ArrayBuffer,
  ): void {
    this.sendTunnelMessageBroadcastChannel.postMessage({
      destinationToken,
      payload,
    });
  }

  public postOnlineUsersCount(payload: ArrayBuffer): void {
    this.notifyOnlineUsersCountBroadcastChannel.postMessage({ payload });
  }

  public postKick(userId: string): void {
    this.kickUserBroadcastChannel.postMessage({ userId });
  }

  public postUserBanNotification(
    hostUserId: string,
    bannedUserNetworkId: string,
  ): void {
    this.sendUserBanNotificationBroadcastChannel.postMessage({
      hostUserId,
      bannedUserNetworkId,
    });
  }
}

export default WebSocketBroadcastService;
