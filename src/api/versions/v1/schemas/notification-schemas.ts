import { z } from "@hono/zod-openapi";
import { NotificationChannelType } from "../enums/notification-channel-enum.ts";

export const PushServerNotificationSchema = z.object({
  channelId: z
    .enum(NotificationChannelType)
    .describe("The notification channel type")
    .openapi({
      example: NotificationChannelType.Global,
    }),
  text: z.string().min(1).describe("The notification message text").openapi({
    example: "This is a test notification coming from the server",
  }),
});

export type PushServerNotification = z.infer<
  typeof PushServerNotificationSchema
>;

export const PushUserNotificationSchema = z.object({
  channelId: z
    .enum(NotificationChannelType)
    .describe("The notification channel type")
    .openapi({
      example: NotificationChannelType.Global,
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
