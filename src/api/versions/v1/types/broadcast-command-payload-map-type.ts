import { NotificationChannelType } from "../enums/notification-channel-enum.ts";

export type BroadcastCommandPayloadMap = {
  Notification: {
    channelId: NotificationChannelType;
    message: string;
  };
  OnlinePlayers: {
    payload: ArrayBuffer;
  };
  PlayerRelay: {
    destinationToken: string;
    payload: ArrayBuffer;
  };
  PlayerNotification: {
    userId: string;
    channelId: NotificationChannelType;
    message: string;
  };
  KickPlayer: {
    userId: string;
  };
  PlayerKickedNotification: {
    hostUserId: string;
    bannedUserNetworkId: string;
  };
  RefreshBlockedWordsCache: null;
};
