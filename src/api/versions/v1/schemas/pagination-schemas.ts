import { z } from "@hono/zod-openapi";

export const PaginationSchema = z.object({
  cursor: z
    .string()
    .optional()
    .describe("Encoded cursor for pagination")
    .openapi({
      example:
        "eyJ0aW1lc3RhbXAiOjE2OTQ5NzYwMDAwMDAsInJvbGVJZCI6IjExMTExMTExLTExMTEtMTExMS0xMTExLTExMTExMTExMTExMSJ9",
    }),
  limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .describe("Maximum number of items to return")
    .openapi({ example: 20 }),
});

export type PaginationParams = z.infer<typeof PaginationSchema>;

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(
  dataSchema: T
) =>
  z.object({
    data: z.array(dataSchema),
    nextCursor: z
      .string()
      .optional()
      .describe("Encoded cursor for the next page of results"),
    hasMore: z
      .boolean()
      .describe("Indicates if more pages are available for pagination"),
  });

export type PaginatedResponse<T> = {
  data: T[];
  nextCursor?: string;
  hasMore: boolean;
};
