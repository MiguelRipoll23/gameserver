import { z } from "@hono/zod-openapi";

export const CreateMessageRequestSchema = z.object({
  title: z
    .string()
    .describe("The message title")
    .openapi({ example: "Hello world!" }),
  content: z.string().describe("The message content").openapi({
    example: "This is a really great message just for you.",
  }),
});

export type CreateMessageRequest = z.infer<typeof CreateMessageRequestSchema>;

export const DeleteMessageRequestSchema = z.object({
  id: z
    .coerce.number()
    .describe("The ID of the message to delete")
    .openapi({
      example: 1,
    }),
});

export type DeleteMessageRequest = z.infer<typeof DeleteMessageRequestSchema>;

export const GetMessageResponseSchema = z.array(
  z.object({
    id: z
      .number()
      .describe("The message ID")
      .openapi({ example: 1 }),
    title: z
      .string()
      .describe("The message title")
      .openapi({ example: "Hello world!" }),
    content: z.string().describe("The message content").openapi({
      example: "This is a really great message just for you.",
    }),
    createdAt: z
      .number()
      .describe("The message created timestamp")
      .openapi({ example: 1740325296918 }),
    updatedAt: z
      .optional(z.number())
      .describe("The message updated timestamp")
      .openapi({ example: 1740325296918 }),
  }),
);

export type GetMessageResponse = z.infer<typeof GetMessageResponseSchema>;

export const UpdateMessageRequestSchema = z.object({
  id: z
    .coerce.number()
    .describe("The ID of the message to update")
    .openapi({ example: 1 }),
  title: z
    .string()
    .describe("The new message title")
    .openapi({ example: "Updated Hello world!" }),
  content: z
    .string()
    .describe("The new message content")
    .openapi({ example: "This message has been updated." }),
});

export type UpdateMessageRequest = z.infer<typeof UpdateMessageRequestSchema>;
