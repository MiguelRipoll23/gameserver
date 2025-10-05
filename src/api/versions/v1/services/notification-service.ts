import { injectable } from "@needle-di/core";
import {
  SEND_NOTIFICATION_EVENT,
  SEND_USER_NOTIFICATION_EVENT,
} from "../constants/event-constants.ts";
import { ServerError } from "../models/server-error.ts";

@injectable()
export class NotificationService {
  public notify(channelId: number, text: string): void {
    const message = text.trim();

    // Check if the message is empty
    if (message.length === 0) {
      throw new ServerError(
        "EMPTY_NOTIFICATION_MESSAGE",
        "Notification message cannot be empty",
        400
      );
    }

    // Validate channelId
    if (channelId < 0) {
      throw new ServerError(
        "INVALID_CHANNEL_ID",
        "Channel ID must be a non-negative number",
        400
      );
    }

    const customEvent = new CustomEvent(SEND_NOTIFICATION_EVENT, {
      detail: {
        channelId,
        message,
      },
    });

    dispatchEvent(customEvent);
  }

  public notifyUser(userId: string, text: string): void {
    const message = text.trim();

    // Check if the message is empty
    if (message.length === 0) {
      throw new ServerError(
        "EMPTY_NOTIFICATION_MESSAGE",
        "Notification message cannot be empty",
        400
      );
    }

    // Check if userId is provided
    if (!userId || userId.trim().length === 0) {
      throw new ServerError("INVALID_USER_ID", "User ID must be provided", 400);
    }

    const customEvent = new CustomEvent(SEND_USER_NOTIFICATION_EVENT, {
      detail: {
        userId: userId.trim(),
        message,
      },
    });

    dispatchEvent(customEvent);
  }
}
