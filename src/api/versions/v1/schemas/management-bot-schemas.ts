import { z } from "@hono/zod-openapi";
import {
  StringPaginatedResponseSchema,
  StringPaginationSchema,
} from "./pagination-schemas.ts";

export const CreateBotRequestSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(32)
    .describe("Display name of the bot")
    .openapi({ example: "MatchmakingBot" }),
  description: z
    .string()
    .max(500)
    .optional()
    .describe("Optional description of the bot"),
});

export type CreateBotRequest = z.infer<typeof CreateBotRequestSchema>;

export const CreateBotResponseSchema = z.object({
  id: z
    .string()
    .uuid()
    .describe("Unique identifier for the created bot")
    .openapi({ example: "00000000-0000-0000-0000-000000000000" }),
  name: z.string().describe("Display name of the bot"),
  description: z.string().nullable().describe("Description of the bot"),
});

export type CreateBotResponse = z.infer<typeof CreateBotResponseSchema>;

export const UpdateBotRequestSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(32)
    .optional()
    .describe("Display name of the bot")
    .openapi({ example: "MatchmakingBot" }),
  description: z
    .string()
    .max(500)
    .nullable()
    .optional()
    .describe("Description of the bot"),
});

export type UpdateBotRequest = z.infer<typeof UpdateBotRequestSchema>;

export const UpdateBotResponseSchema = z.object({
  id: z.string().uuid().describe("Unique identifier for the bot"),
  name: z.string().describe("Display name of the bot"),
  description: z.string().nullable().describe("Description of the bot"),
  createdBy: z.string().uuid().describe(
    "User ID of the manager who created the bot",
  ),
  createdAt: z.string().describe("Creation date of the bot"),
});

export type UpdateBotResponse = z.infer<typeof UpdateBotResponseSchema>;

export const GetBotsQuerySchema = StringPaginationSchema;

export const BotResponseSchema = z.object({
  id: z.string().uuid().describe("Unique identifier for the bot"),
  name: z.string().describe("Display name of the bot"),
  description: z.string().nullable().describe("Description of the bot"),
  createdBy: z.string().uuid().describe(
    "User ID of the manager who created the bot",
  ),
  createdAt: z.string().describe("Creation date of the bot"),
});

export type BotResponse = z.infer<typeof BotResponseSchema>;

export const GetBotsResponseSchema = StringPaginatedResponseSchema(
  BotResponseSchema,
);

export type GetBotsResponse = z.infer<typeof GetBotsResponseSchema>;

export const GetBotTokenResponseSchema = z.object({
  token: z
    .string()
    .describe("Long-lived JWT used by the bot to authenticate requests"),
});

export type GetBotTokenResponse = z.infer<typeof GetBotTokenResponseSchema>;

export const AddBotRoleRequestSchema = z.object({
  roleName: z
    .string()
    .min(1)
    .max(50)
    .describe("Role name to add")
    .openapi({ example: "moderator" }),
});

export type AddBotRoleRequest = z.infer<typeof AddBotRoleRequestSchema>;

export const RemoveBotRoleRequestSchema = z.object({
  roleName: z
    .string()
    .min(1)
    .max(50)
    .describe("Role name to remove")
    .openapi({ example: "moderator" }),
});

export type RemoveBotRoleRequest = z.infer<typeof RemoveBotRoleRequestSchema>;

export const BotRoleResponseSchema = z.object({
  botId: z.string().uuid().describe("Unique identifier for the bot"),
  roleName: z.string().describe("Role name"),
  createdAt: z.string().describe("Assignment creation date"),
});

export type BotRoleResponse = z.infer<typeof BotRoleResponseSchema>;

export const GetBotRolesResponseSchema = z.array(BotRoleResponseSchema);

export type GetBotRolesResponse = z.infer<typeof GetBotRolesResponseSchema>;
