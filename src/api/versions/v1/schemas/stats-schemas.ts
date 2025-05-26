import { z } from "@hono/zod-openapi";

export const GetStatsResponseSchema = z.object({
  total_sessions: z
    .number()
    .min(0)
    .describe("The total number of sessions")
    .openapi({ example: 3 }),
});

export type GetStatsResponse = z.infer<typeof GetStatsResponseSchema>;
