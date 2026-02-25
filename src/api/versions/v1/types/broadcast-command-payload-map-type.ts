import { NotificationChannelType } from "../enums/notification-channel-enum.ts";

export type BroadcastCommandPayloadMap = {
  OnlineUsersCount: {
    payload: ArrayBuffer;
  };
  TunnelMessage: {
    destinationToken: string;
    payload: ArrayBuffer;
  };
  UserNotification: {
    userId: string;
    channelId: NotificationChannelType;
    message: string;
  };
  KickUser: {
    userId: string;
  };
  UserKickedNotification: {
    hostUserId: string;
    bannedUserNetworkId: string;
  };
  RefreshBlockedWordsCache: null;
};
