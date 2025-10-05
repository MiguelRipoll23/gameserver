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

// Schema for pagination with string-based cursor (e.g., for composite keys)
export const StringPaginationSchema = z.object({
  cursor: z
    .string()
    .optional()
    .describe("Cursor for pagination (encoded position from previous page)"),
  limit: z.coerce
    .number()
    .min(1)
    .max(100)
    .default(20)
    .describe("Maximum number of items to return")
    .openapi({ example: 10 }),
});

export type PaginationParams = z.infer<typeof PaginationSchema>;
export type StringPaginationParams = z.infer<typeof StringPaginationSchema>;

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

// Response schema for string-based cursors
export const StringPaginatedResponseSchema = <T extends z.ZodTypeAny>(
  dataSchema: T
) =>
  z.object({
    results: z.array(dataSchema),
    nextCursor: z
      .string()
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

export type StringPaginatedResponse<T> = {
  results: T[];
  nextCursor?: string;
  hasMore: boolean;
};
