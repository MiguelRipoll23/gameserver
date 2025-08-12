import { z } from "@hono/zod-openapi";
import {
  PaginationSchema,
  PaginatedResponseSchema,
} from "./pagination-schemas.ts";

export const BlockWordRequestSchema = z.object({
  word: z
    .string()
    .min(1)
    .max(255)
    .describe("The word to block")
    .openapi({ example: "badword" }),
  notes: z
    .string()
    .optional()
    .describe("Optional notes about why this word is blocked")
    .openapi({ example: "Contains inappropriate content" }),
});

export type BlockWordRequest = z.infer<typeof BlockWordRequestSchema>;

export const GetBlockedWordsRequestSchema = PaginationSchema.extend({
  word: z
    .string()
    .min(1)
    .max(255)
    .optional()
    .describe("Optional word filter")
    .openapi({ example: "bad" }),
});

export type GetBlockedWordsRequest = z.infer<
  typeof GetBlockedWordsRequestSchema
>;

export const UnblockWordRequestSchema = z.object({
  word: z
    .string()
    .min(1)
    .max(255)
    .describe("The word to unblock")
    .openapi({ example: "word" }),
});

export type UnblockWordRequest = z.infer<typeof UnblockWordRequestSchema>;

export const UpdateWordRequestSchema = z.object({
  word: z
    .string()
    .min(1)
    .max(255)
    .describe("The current word to update")
    .openapi({ example: "oldword" }),
  newWord: z
    .string()
    .min(1)
    .max(255)
    .describe("The new word to replace it with")
    .openapi({ example: "newword" }),
  notes: z
    .string()
    .optional()
    .describe("Optional updated notes about why this word is blocked")
    .openapi({ example: "Updated reason for blocking" }),
});

export type UpdateWordRequest = z.infer<typeof UpdateWordRequestSchema>;

export const BlockedWordSchema = z.object({
  id: z.number().int().describe("Unique identifier for the blocked word"),
  word: z.string().describe("The blocked word"),
  notes: z.string().nullable().describe("Notes about why this word is blocked"),
  createdAt: z.string().describe("When the word was first blocked"),
  updatedAt: z.string().nullable().describe("When the word was last updated"),
});

export type BlockedWord = z.infer<typeof BlockedWordSchema>;

export const GetBlockedWordsResponseSchema =
  PaginatedResponseSchema(BlockedWordSchema);

export type GetBlockedWordsResponse = z.infer<
  typeof GetBlockedWordsResponseSchema
>;
