import { z } from "@hono/zod-openapi";

export const PushServerNotificationSchema = z
  .string()
  .min(1)
  .describe("The text of the notification")
  .openapi({
    example: "This is a test notification coming from the server",
  });

export type PushServerNotification = z.infer<
  typeof PushServerNotificationSchema
>;

export const PushUserNotificationSchema = z.object({
  userId: z.string()
    .min(1)
    .describe("The ID of the user to send the notification to")
    .openapi({
      example: "550e8400-e29b-41d4-a716-446655440000",
    }),
  message: z.string()
    .min(1)
    .describe("The text of the notification")
    .openapi({
      example: "You have a new message!",
    }),
});

export type PushUserNotification = z.infer<
  typeof PushUserNotificationSchema
>;
