import { z } from "@hono/zod-openapi";
import {
  StringPaginatedResponseSchema,
  StringPaginationSchema,
} from "./pagination-schemas.ts";

export const UserResponseSchema = z.object({
  id: z.string().uuid().describe("The user ID").openapi({
    example: "6f9619ff-8b86-d011-b42d-00c04fc964ff",
  }),
  displayName: z
    .string()
    .max(16)
    .describe("The user display name")
    .openapi({ example: "JohnDoe" }),
  createdAt: z
    .string()
    .describe("The user created timestamp")
    .openapi({ example: "2026-08-05T12:00:00.000Z" }),
  updatedAt: z
    .string()
    .nullable()
    .describe("The user last updated timestamp")
    .openapi({ example: "2026-08-05T12:00:00.000Z" }),
});

export type UserResponse = z.infer<typeof UserResponseSchema>;

export const GetUsersQuerySchema = StringPaginationSchema;

export type GetUsersQuery = z.infer<typeof StringPaginationSchema>;

export const GetUsersResponseSchema = StringPaginatedResponseSchema(
  UserResponseSchema,
);

export type GetUsersResponse = z.infer<typeof GetUsersResponseSchema>;

export const UpdateUserRequestSchema = z.object({
  displayName: z
    .string()
    .min(1)
    .max(16)
    .describe("The new user display name")
    .openapi({ example: "JohnDoe" }),
});

export type UpdateUserRequest = z.infer<typeof UpdateUserRequestSchema>;