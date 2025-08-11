import { z } from "@hono/zod-openapi";

export const PaginationSchema = z.object({
  cursor: z
    .number()
    .optional()
    .describe("ID of the last item from previous page")
    .openapi({ example: 10 }),
  limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .describe("Maximum number of items to return")
    .openapi({ example: 20 }),
});

export const AdvertiseMatchRequestSchema = z.object({
  version: z
    .string()
    .describe("Version of the game client")
    .openapi({ example: "0.0.1-alpha.1" }),
  totalSlots: z
    .number()
    .min(1)
    .describe("Total number of slots available in the match")
    .openapi({ example: 4 }),
  availableSlots: z
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

export const FindMatchesRequestSchema = z
  .object({
    clientVersion: z
      .string()
      .describe("Version of the client")
      .openapi({ example: "0.0.1-alpha.1" }),
    attributes: z
      .record(z.string(), z.any())
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

export const FindMatchesResponseSchema = z.object({
  results: z.array(
    z.object({
      token: z.string().describe("Token used to join the match"),
    })
  ),
  nextCursor: z
    .number()
    .optional()
    .describe("Cursor for the next page of results"),
  hasMore: z
    .boolean()
    .describe("Indicates if more pages are available for pagination"),
});

export type FindMatchesResponse = z.infer<typeof FindMatchesResponseSchema>;
