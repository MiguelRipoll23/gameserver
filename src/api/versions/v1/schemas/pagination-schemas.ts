import { z } from "@hono/zod-openapi";

export const PaginationSchema = z.object({
  cursor: z.coerce
    .number()
    .optional()
    .describe("Cursor for pagination (ID of last item from previous page)"),
  limit: z.coerce
    .number()
    .min(1)
    .max(100)
    .default(20)
    .describe("Maximum number of items to return")
    .openapi({ example: 10 }),
});

export type PaginationParams = z.infer<typeof PaginationSchema>;

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(
  dataSchema: T
) =>
  z.object({
    results: z.array(dataSchema),
    nextCursor: z
      .number()
      .optional()
      .describe("Cursor for the next page of results"),
    hasMore: z
      .boolean()
      .describe("Indicates if more pages are available for pagination"),
  });

export type PaginatedResponse<T> = {
  results: T[];
  nextCursor?: number;
  hasMore: boolean;
};
