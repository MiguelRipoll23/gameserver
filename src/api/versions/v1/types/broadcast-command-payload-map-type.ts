import { NotificationChannelType } from "../enums/notification-channel-enum.ts";

export type BroadcastCommandPayloadMap = {
  OnlinePlayers: {
    totalSessions: number;
  };
  PlayerIdentity: {
    destinationToken: string;
    originToken: Uint8Array<ArrayBuffer>;
    originNetworkId: string;
    originName: string;
  };
  PlayerRelay: {
    destinationToken: string;
    payload: ArrayBuffer;
  };
  Notification: {
    channelId: NotificationChannelType;
    message: string;
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
