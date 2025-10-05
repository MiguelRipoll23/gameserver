import { z } from "@hono/zod-openapi";

export const PushServerNotificationSchema = z.object({
  channelId: z
    .number()
    .min(0)
    .max(255)
    .describe("The notification channel ID (0-255)")
    .openapi({
      example: 0,
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
    .number()
    .min(0)
    .max(255)
    .describe("The notification channel ID (0-255)")
    .openapi({
      example: 0,
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
