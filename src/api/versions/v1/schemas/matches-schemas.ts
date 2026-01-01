import { z } from "@hono/zod-openapi";
import {
  PaginatedResponseSchema,
  PaginationSchema,
} from "./pagination-schemas.ts";

export const AdvertiseMatchRequestSchema = z.object({
  clientVersion: z
    .string()
    .describe("Version of the game client")
    .openapi({ example: "0.0.1-alpha.1" }),
  totalSlots: z
    .number()
    .min(1)
    .describe("Total number of slots available in the match")
    .openapi({ example: 4 }),
  usersList: z
    .array(z.string().uuid())
    .describe("List of user identifiers (UUID) participating in the match")
    .openapi({ example: ["550e8400-e29b-41d4-a716-446655440000", "6ba7b810-9dad-11d1-80b4-00c04fd430c8"] }),
  pingMedianMilliseconds: z
    .number()
    .min(0)
    .optional()
    .describe("Median ping in milliseconds across all players")
    .openapi({ example: 50 }),
  attributes: z
    .record(z.string(), z.any())
    .optional()
    .describe("Key-value attributes describing the match")
    .openapi({
      example: { mode: "battle" },
    }),
});

export type AdvertiseMatchRequest = z.infer<typeof AdvertiseMatchRequestSchema>;

export const FindMatchesRequestSchema = z
  .object({
    clientVersion: z
      .string()
      .describe("Version of the client")
      .openapi({ example: "0.0.1-alpha.1" }),
    attributes: z
      .record(z.string(), z.unknown())
      .optional()
      .describe("Key-value attributes describing the match")
      .openapi({
        example: { mode: "battle" },
      }),
    totalSlots: z
      .number()
      .min(1)
      .describe("Total number of slots available in the match")
      .openapi({ example: 4 }),
  })
  .merge(PaginationSchema);

export type FindMatchesRequest = z.infer<typeof FindMatchesRequestSchema>;

export const MatchResultSchema = z.object({
  token: z.string().describe("Token used to join the match"),
});

export const FindMatchesResponseSchema = PaginatedResponseSchema(
  MatchResultSchema,
);

export type FindMatchesResponse = z.infer<typeof FindMatchesResponseSchema>;
