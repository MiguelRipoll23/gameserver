import { injectable } from "@needle-di/core";
import { SEND_NOTIFICATION_EVENT } from "../constants/event-constants.ts";
import { ServerError } from "../models/server-error.ts";

@injectable()
export class NotificationService {
  public notify(text: string): void {
    const message = text.trim();

    // Check if the message is empty
    if (message.length === 0) {
      throw new ServerError(
        "EMPTY_NOTIFICATION_MESSAGE",
        "Notification message cannot be empty",
        400
      );
    }

    const customEvent = new CustomEvent(SEND_NOTIFICATION_EVENT, {
      detail: {
        message,
      },
    });

    dispatchEvent(customEvent);
  }
}
