import { z } from "@hono/zod-openapi";
import {
  PaginatedResponseSchema,
  PaginationSchema,
} from "./pagination-schemas.ts";

export const CreateServerMessageRequestSchema = z.object({
  title: z
    .string()
    .describe("The message title")
    .openapi({ example: "Hello world!" }),
  content: z.string().describe("The message content").openapi({
    example: "This is a really great message just for you.",
  }),
});

export type CreateServerMessageRequest = z.infer<
  typeof CreateServerMessageRequestSchema
>;

export const DeleteServerMessageRequestSchema = z.object({
  id: z.coerce
    .number()
    .int()
    .positive()
    .describe("The ID of the message to delete")
    .openapi({
      example: 1,
    }),
});

export type DeleteServerMessageRequest = z.infer<
  typeof DeleteServerMessageRequestSchema
>;

export const ServerMessageResponseSchema = z.object({
  id: z.number().describe("The message ID").openapi({ example: 1 }),
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
    .number()
    .describe("The message updated timestamp")
    .openapi({ example: 1740325296918 }),
});

export type ServerMessageResponse = z.infer<
  typeof ServerMessageResponseSchema
>;

export const GetServerMessagesResponseSchema = PaginatedResponseSchema(
  ServerMessageResponseSchema,
);

export type GetServerMessagesResponse = z.infer<
  typeof GetServerMessagesResponseSchema
>;

export const GetServerMessagesQuerySchema = PaginationSchema;

export const UpdateServerMessageRequestSchema = z.object({
  id: z.coerce
    .number()
    .int()
    .positive()
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

export type UpdateServerMessageRequest = z.infer<
  typeof UpdateServerMessageRequestSchema
>;
