import { NotificationChannelType } from "../enums/notification-channel-enum.ts";

export interface NotificationPayload {
  channelId: NotificationChannelType;
  message: string;
}
