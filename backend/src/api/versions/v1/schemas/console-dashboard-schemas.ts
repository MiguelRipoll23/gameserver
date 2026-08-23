import { z } from "@hono/zod-openapi";

export const ConsoleDashboardLatestServerMessageSchema = z.object({
  id: z.number().int().describe("The message ID").openapi({ example: 1 }),
  title: z
    .string()
    .describe("The message title")
    .openapi({ example: "Hello world!" }),
  content: z
    .string()
    .describe("The message content")
    .openapi({
      example: "This is a really great message just for you.",
    }),
  createdAt: z
    .number()
    .describe("The message created timestamp")
    .openapi({ example: 1740325296918 }),
});

export type ConsoleDashboardLatestServerMessage = z.infer<
  typeof ConsoleDashboardLatestServerMessageSchema
>;

export const GetConsoleDashboardResponseSchema = z.object({
  minimumVersion: z
    .string()
    .nullable()
    .describe(
      "The minimum version of the game client, or null when not configured",
    )
    .openapi({ example: "1.0.0-alpha.1" }),
  usersCount: z
    .number()
    .int()
    .nonnegative()
    .describe("Total number of registered users")
    .openapi({ example: 3 }),
  botsCount: z
    .number()
    .int()
    .nonnegative()
    .describe("Total number of bots")
    .openapi({ example: 1 }),
  sessionsCount: z
    .number()
    .int()
    .nonnegative()
    .describe("Total number of user sessions")
    .openapi({ example: 2 }),
  matchesCount: z
    .number()
    .int()
    .nonnegative()
    .describe("Total number of advertised matches")
    .openapi({ example: 0 }),
  scoresCount: z
    .number()
    .int()
    .nonnegative()
    .describe("Total number of saved user scores")
    .openapi({ example: 5 }),
  reportsCount: z
    .number()
    .int()
    .nonnegative()
    .describe("Total number of user reports")
    .openapi({ example: 0 }),
  bansCount: z
    .number()
    .int()
    .nonnegative()
    .describe("Total number of user bans")
    .openapi({ example: 1 }),
  blockedWordsCount: z
    .number()
    .int()
    .nonnegative()
    .describe("Total number of blocked words")
    .openapi({ example: 0 }),
  antiCheatRulesCount: z
    .number()
    .int()
    .nonnegative()
    .describe("Total number of anti-cheat rules")
    .openapi({ example: 1 }),
  latestServerMessage:
    ConsoleDashboardLatestServerMessageSchema.nullable().describe(
      "The most recent server message, or null when there are none",
    ),
});

export type GetConsoleDashboardResponse = z.infer<
  typeof GetConsoleDashboardResponseSchema
>;
