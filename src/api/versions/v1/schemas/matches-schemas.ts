import { z } from "@hono/zod-openapi";

export const AdvertiseMatchRequestSchema = z.object({
  version: z
    .string()
    .describe("Version of the game client")
    .openapi({ example: "0.0.1-alpha.1" }),
  total_slots: z
    .number()
    .min(1)
    .describe("Total number of slots available in the match")
    .openapi({ example: 4 }),
  available_slots: z
    .number()
    .min(0)
    .describe("Number of slots currently available")
    .openapi({ example: 3 }),
  attributes: z
    .record(z.string(), z.any())
    .optional()
    .describe("Key-value attributes describing the match")
    .openapi({
      example: { mode: "battle" },
    }),
});

export type AdvertiseMatchRequest = z.infer<typeof AdvertiseMatchRequestSchema>;

export const FindMatchesRequestSchema = z.object({
  version: z
    .string()
    .describe("Version of the game client")
    .openapi({ example: "0.0.1-alpha.1" }),
  attributes: z
    .record(z.string(), z.any())
    .optional()
    .describe("Key-value attributes describing the match")
    .openapi({
      example: { mode: "battle" },
    }),
  total_slots: z
    .number()
    .min(1)
    .describe("Total number of slots available in the match")
    .openapi({ example: 4 }),
});

export type FindMatchesRequest = z.infer<typeof FindMatchesRequestSchema>;

export const FindMatchesResponseSchema = z.array(
  z.object({
    token: z.string().describe("Token used to join the match"),
  }),
);

export type FindMatchesResponse = z.infer<typeof FindMatchesResponseSchema>;
