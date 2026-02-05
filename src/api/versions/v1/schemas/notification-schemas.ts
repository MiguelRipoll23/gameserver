import { z } from "@hono/zod-openapi";
import { NotificationChannelName } from "../enums/notification-channel-enum.ts";

export const PushServerNotificationSchema = z.object({
  channelName: z
    .nativeEnum(NotificationChannelName)
    .describe("Human-readable channel identifier exposed by the API")
    .openapi({
      example: NotificationChannelName.Global,
    }),
  text: z.string().min(1).describe("The notification message text").openapi({
    example: "This is a test notification coming from the server",
  }),
});

export type PushServerNotification = z.infer<
  typeof PushServerNotificationSchema
>;

export const PushUserNotificationSchema = z.object({
  channelName: z
    .nativeEnum(NotificationChannelName)
    .describe("Human-readable channel identifier exposed by the API")
    .openapi({
      example: NotificationChannelName.Global,
    }),
  userId: z
    .string()
    .min(1)
    .describe("The unique identifier of the user to receive the notification")
    .openapi({
      example: "550e8400-e29b-41d4-a716-446655440000",
    }),
  text: z.string().min(1).describe("The notification message text").openapi({
    example: "This is a test notification coming from the server just for you",
  }),
});

export type PushUserNotification = z.infer<typeof PushUserNotificationSchema>;
