import { inject, injectable } from "@needle-di/core";
import { ServerError } from "../models/server-error.ts";
import { NotificationChannelType } from "../enums/notification-channel-enum.ts";
import { EventsService } from "./events-service.ts";
import { BroadcastCommandType } from "../enums/broadcast-command-enum.ts";
import {
  EVENT_DISPATCH_MODE_LOCAL_AND_BROADCAST,
  EVENT_DISPATCH_MODE_LOCAL_OR_BROADCAST,
} from "../constants/event-constants.ts";

@injectable()
export class NotificationService {
  constructor(
    private readonly eventsService = inject(EventsService),
  ) {}

  public notify(channelId: NotificationChannelType, text: string): void {
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

    this.eventsService.dispatch(
      BroadcastCommandType.Notification,
      {
        channelId,
        message,
      },
      EVENT_DISPATCH_MODE_LOCAL_AND_BROADCAST,
    );
  }

  public notifyUser(
    channelId: NotificationChannelType,
    userId: string,
    text: string,
  ): void {
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

    this.eventsService.dispatch(
      BroadcastCommandType.PlayerNotification,
      {
        userId: userId.trim(),
        channelId,
        message,
      },
      EVENT_DISPATCH_MODE_LOCAL_OR_BROADCAST,
    );
  }
}
