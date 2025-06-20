import { z } from "@hono/zod-openapi";

export const SaveScoresRequestSchema = z.array(
  z.object({
    playerId: z
      .string()
      .length(32)
      .describe("The unique identifier of the player"),
    playerName: z
      .string()
      .min(1)
      .max(16)
      .describe("The name of the player")
      .openapi({ example: "MiguelRipoll23" }),
    score: z
      .number()
      .min(0)
      .describe("The score of the player")
      .openapi({ example: 4 }),
  }),
);

export type SaveScoresRequest = z.infer<typeof SaveScoresRequestSchema>;

export const GetScoresResponseSchema = z.array(
  z.object({
    playerName: z
      .string()
      .min(1)
      .max(16)
      .describe("The name of the player")
      .openapi({
        example: "MiguelRipoll23",
      }),
    score: z.number().min(0).describe("The score of the player").openapi({
      example: 4,
    }),
  }),
);

export type GetScoresResponse = z.infer<typeof GetScoresResponseSchema>;
