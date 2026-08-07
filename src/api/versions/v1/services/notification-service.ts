import { injectable } from "@needle-di/core";
import { ServerError } from "../models/server-error.ts";
import { NotificationChannelType } from "../enums/notification-channel-enum.ts";
import { getHubStub } from "../../../../core/utils/environment.ts";

@injectable()
export class NotificationService {
  constructor() {}

  public async notify(
    channelId: NotificationChannelType,
    text: string,
  ): Promise<void> {
    const message = text.trim();

    // Check if the message is empty
    if (message.length === 0) {
      throw new ServerError(
        "EMPTY_NOTIFICATION_MESSAGE",
        "Notification message cannot be empty",
        400,
      );
    }

    // Validate channelId
    if (!Object.values(NotificationChannelType).includes(channelId)) {
      throw new ServerError(
        "INVALID_CHANNEL_ID",
        "Invalid notification channel type",
        400,
      );
    }

    await getHubStub().pushServerNotification(channelId, message);
  }

  public async notifyUser(
    channelId: NotificationChannelType,
    userId: string,
    text: string,
  ): Promise<void> {
    const message = text.trim();

    // Check if the message is empty
    if (message.length === 0) {
      throw new ServerError(
        "EMPTY_NOTIFICATION_MESSAGE",
        "Notification message cannot be empty",
        400,
      );
    }

    // Check if userId is provided
    if (!userId || userId.trim().length === 0) {
      throw new ServerError("INVALID_USER_ID", "User ID must be provided", 400);
    }

    // Validate channelId
    if (!Object.values(NotificationChannelType).includes(channelId)) {
      throw new ServerError(
        "INVALID_CHANNEL_ID",
        "Invalid notification channel type",
        400,
      );
    }

    await getHubStub().pushUserNotification(userId.trim(), channelId, message);
  }
}
