import { z } from "@hono/zod-openapi";
import { PaginatedResponseSchema } from "./pagination-schemas.ts";

export const AddUserRoleRequestSchema = z.object({
  userId: z
    .string()
    .length(36)
    .describe("User ID to add role to")
    .openapi({ example: "00000000-0000-0000-0000-000000000000" }),
  roleName: z
    .string()
    .min(1)
    .max(50)
    .describe("Role name to add")
    .openapi({ example: "moderator" }),
});

export type AddUserRoleRequest = z.infer<typeof AddUserRoleRequestSchema>;

export const RemoveUserRoleRequestSchema = z.object({
  userId: z
    .string()
    .length(36)
    .describe("User ID to remove role from")
    .openapi({ example: "00000000-0000-0000-0000-000000000000" }),
  roleName: z
    .string()
    .min(1)
    .max(50)
    .describe("Role name to remove")
    .openapi({ example: "moderator" }),
});

export type RemoveUserRoleRequest = z.infer<typeof RemoveUserRoleRequestSchema>;

export const GetUserRolesRequestSchema = z.object({
  userId: z
    .string()
    .length(36)
    .describe("The user ID to get roles for")
    .openapi({ example: "00000000-0000-0000-0000-000000000000" }),
  cursor: z
    .number()
    .optional()
    .describe("Cursor for pagination (ID of last item from previous page)"),
  limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .describe("Maximum number of items to return")
    .openapi({ example: 20 }),
});

export type GetUserRolesRequest = z.infer<typeof GetUserRolesRequestSchema>;

export const UserRoleResponseSchema = z.object({
  userId: z.string().describe("User ID"),
  roleName: z.string().describe("Role name"),
  createdAt: z.string().describe("Assignment creation date"),
});

export type UserRoleResponse = z.infer<typeof UserRoleResponseSchema>;

export const GetUserRolesResponseSchema = PaginatedResponseSchema(
  UserRoleResponseSchema
);

export type GetUserRolesResponse = z.infer<typeof GetUserRolesResponseSchema>;
