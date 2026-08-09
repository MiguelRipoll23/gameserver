import { z } from "@hono/zod-openapi";
import {
  StringPaginatedResponseSchema,
  StringPaginationSchema,
} from "./pagination-schemas.ts";

export const GetUserSessionsQuerySchema = StringPaginationSchema;

export const UserSessionResponseSchema = z.object({
  userId: z
    .string()
    .uuid()
    .describe("The user ID the session belongs to")
    .openapi({ example: "550e8400-e29b-41d4-a716-446655440000" }),
  token: z
    .string()
    .describe("The session token used to authenticate the connection"),
  publicIp: z.string().describe("The public IP the session was created from"),
  country: z
    .string()
    .nullable()
    .describe("The country resolved from the public IP, if available"),
  createdAt: z
    .string()
    .describe("The date the session was created")
    .openapi({ example: "2026-08-09T12:00:00.000Z" }),
  updatedAt: z
    .string()
    .describe("The date the session was last updated")
    .openapi({ example: "2026-08-09T12:00:00.000Z" }),
});

export type UserSessionResponse = z.infer<typeof UserSessionResponseSchema>;

export const GetUserSessionsResponseSchema = StringPaginatedResponseSchema(
  UserSessionResponseSchema,
);

export type GetUserSessionsResponse = z.infer<
  typeof GetUserSessionsResponseSchema
>;

export const DeleteUserSessionParamsSchema = z.object({
  userId: z
    .string()
    .uuid()
    .describe("The user ID whose session should be deleted"),
});
