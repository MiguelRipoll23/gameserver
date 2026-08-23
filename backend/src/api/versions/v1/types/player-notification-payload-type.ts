import { NotificationChannelType } from "../enums/notification-channel-enum.ts";

export interface PlayerNotificationPayload {
  userId: string;
  channelId: NotificationChannelType;
  message: string;
}
