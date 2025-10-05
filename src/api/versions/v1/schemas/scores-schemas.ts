import { z } from "@hono/zod-openapi";
import {
  PaginationSchema,
  PaginatedResponseSchema,
} from "./pagination-schemas.ts";

export const SaveScoresRequestSchema = z.array(
  z.object({
    userId: z.string().length(36).describe("The unique identifier of the user"),
    totalScore: z
      .number()
      .min(0)
      .describe("The total score of the user")
      .openapi({ example: 4 }),
  })
);

export type SaveScoresRequest = z.infer<typeof SaveScoresRequestSchema>;

export const GetScoresQuerySchema = PaginationSchema;

export const UserScoreResponseSchema = z.object({
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

export const GetScoresResponseSchema = PaginatedResponseSchema(
  UserScoreResponseSchema
);

export type GetScoresResponse = z.infer<typeof GetScoresResponseSchema>;
