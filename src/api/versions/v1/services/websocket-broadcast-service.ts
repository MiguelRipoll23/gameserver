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

  onTunnelMessage(cb: (event: MessageEvent) => void): void {
    this.sendTunnelMessageBroadcastChannel.onmessage = (e) =>
      cb(e as MessageEvent);
  }

  onOnlineUsersCount(cb: (event: MessageEvent) => void): void {
    this.notifyOnlineUsersCountBroadcastChannel.onmessage = (e) =>
      cb(e as MessageEvent);
  }

  onKickUser(cb: (event: MessageEvent) => void): void {
    this.kickUserBroadcastChannel.onmessage = (e) => cb(e as MessageEvent);
  }

  onUserBanNotification(cb: (event: MessageEvent) => void): void {
    this.sendUserBanNotificationBroadcastChannel.onmessage = (e) =>
      cb(e as MessageEvent);
  }

  postTunnelMessage(destinationToken: string, payload: ArrayBuffer): void {
    try {
      this.sendTunnelMessageBroadcastChannel.postMessage({
        destinationToken,
        payload,
      });
    } catch (error) {
      console.error(
        "Failed to post tunnel message to broadcast channel",
        error,
      );
    }
  }

  postOnlineUsersCount(payload: ArrayBuffer): void {
    try {
      this.notifyOnlineUsersCountBroadcastChannel.postMessage({ payload });
    } catch (error) {
      console.error(
        "Failed to post online users count to broadcast channel",
        error,
      );
    }
  }

  postKick(userId: string): void {
    try {
      this.kickUserBroadcastChannel.postMessage({ userId });
    } catch (error) {
      console.error("Failed to post kick to broadcast channel", error);
    }
  }

  postUserBanNotification(
    hostUserId: string,
    bannedUserNetworkId: string,
  ): void {
    try {
      this.sendUserBanNotificationBroadcastChannel.postMessage({
        hostUserId,
        bannedUserNetworkId,
      });
    } catch (error) {
      console.error(
        "Failed to post user-ban notification to broadcast channel",
        error,
      );
    }
  }
}

export default WebSocketBroadcastService;
