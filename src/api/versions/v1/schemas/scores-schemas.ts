import { z } from "@hono/zod-openapi";
import {
  StringPaginatedResponseSchema,
  StringPaginationSchema,
} from "./pagination-schemas.ts";

export const SaveScoresRequestSchema = z.array(
  z.object({
    userId: z.string().length(36).describe("The unique identifier of the user"),
    totalScore: z
      .number()
      .min(0)
      .describe("The total score of the user")
      .openapi({ example: 4 }),
  }),
);

export type SaveScoresRequest = z.infer<typeof SaveScoresRequestSchema>;

export const GetScoresQuerySchema = StringPaginationSchema;

export const UserScoreResponseSchema = z.object({
  userId: z
    .string()
    .uuid()
    .describe("The unique identifier of the user")
    .openapi({ example: "550e8400-e29b-41d4-a716-446655440000" }),
  userDisplayName: z
    .string()
    .min(1)
    .max(16)
    .describe("The display name of the user")
    .openapi({
      example: "MiguelRipoll23",
    }),
  totalScore: z.number().min(0).describe("The score of the user").openapi({
    example: 4,
  }),
});

export type UserScoreResponse = z.infer<typeof UserScoreResponseSchema>;

export const GetScoresResponseSchema = StringPaginatedResponseSchema(
  UserScoreResponseSchema,
);

export type GetScoresResponse = z.infer<typeof GetScoresResponseSchema>;

export const UpdateUserScoreParamsSchema = z.object({
  userId: z
    .string()
    .uuid()
    .describe("The ID of the user whose score should be updated"),
});

export const UpdateUserScoreRequestSchema = z.object({
  totalScore: z
    .number()
    .min(0)
    .describe("The new total score of the user")
    .openapi({ example: 4 }),
});

export type UpdateUserScoreRequest = z.infer<
  typeof UpdateUserScoreRequestSchema
>;
