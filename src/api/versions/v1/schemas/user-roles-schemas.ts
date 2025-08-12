import { z } from "@hono/zod-openapi";
import { PaginationSchema } from "./pagination-schemas.ts";

export const AddUserRoleRequestSchema = z.object({
  userId: z
    .string()
    .length(36)
    .describe("User ID to add role to")
    .openapi({ example: "00000000-0000-0000-0000-000000000000" }),
  roleId: z
    .string()
    .length(36)
    .describe("Role ID to add")
    .openapi({ example: "11111111-1111-1111-1111-111111111111" }),
});

export type AddUserRoleRequest = z.infer<typeof AddUserRoleRequestSchema>;

export const RemoveUserRoleRequestSchema = z.object({
  userId: z
    .string()
    .length(36)
    .describe("User ID to remove role from")
    .openapi({ example: "00000000-0000-0000-0000-000000000000" }),
  roleId: z
    .string()
    .length(36)
    .describe("Role ID to remove")
    .openapi({ example: "11111111-1111-1111-1111-111111111111" }),
});

export type RemoveUserRoleRequest = z.infer<typeof RemoveUserRoleRequestSchema>;

export const GetUserRolesRequestSchema = z
  .object({
    userId: z
      .string()
      .length(36)
      .describe("The user ID to get roles for")
      .openapi({ example: "00000000-0000-0000-0000-000000000000" }),
  })
  .and(PaginationSchema);

export type GetUserRolesRequest = z.infer<typeof GetUserRolesRequestSchema>;

export const UserRoleResponseSchema = z.object({
  userId: z.string().describe("User ID"),
  roleId: z.string().describe("Role ID"),
  roleName: z.string().describe("Role name"),
  roleDescription: z.string().nullable().describe("Role description"),
  createdAt: z.string().describe("Assignment creation date"),
});

export type UserRoleResponse = z.infer<typeof UserRoleResponseSchema>;

export const GetUserRolesResponseSchema = z.object({
  data: z.array(UserRoleResponseSchema),
  nextCursor: z
    .number()
    .optional()
    .describe("Cursor for the next page of results"),
  hasMore: z
    .boolean()
    .describe("Indicates if more pages are available for pagination"),
});

export type GetUserRolesResponse = z.infer<typeof GetUserRolesResponseSchema>;
