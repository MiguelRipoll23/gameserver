import { z } from "@hono/zod-openapi";

export const BlockWordRequestSchema = z.object({
  word: z
    .string()
    .min(1)
    .max(100)
    .describe("The word to block")
    .openapi({ example: "badword" }),
  notes: z
    .string()
    .max(255)
    .optional()
    .describe("Optional notes about why this word is blocked")
    .openapi({ example: "Contains inappropriate content" }),
});

export type BlockWordRequest = z.infer<typeof BlockWordRequestSchema>;

export const CheckWordRequestSchema = z.object({
  word: z
    .string()
    .min(1)
    .max(100)
    .describe("The word to check")
    .openapi({ example: "example" }),
});

export type CheckWordRequest = z.infer<typeof CheckWordRequestSchema>;

export const UnblockWordRequestSchema = z.object({
  word: z
    .string()
    .min(1)
    .max(100)
    .describe("The word to unblock")
    .openapi({ example: "word" }),
});

export type UnblockWordRequest = z.infer<typeof UnblockWordRequestSchema>;

export const WordBlockedResponseSchema = z.object({
  blocked: z
    .boolean()
    .describe("Whether the word is blocked")
    .openapi({ example: true }),
});

export type WordBlockedResponse = z.infer<typeof WordBlockedResponseSchema>;
