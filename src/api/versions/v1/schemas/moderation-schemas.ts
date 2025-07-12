import { z } from "@hono/zod-openapi";

export const BanUserRequestSchema = z.object({
  userId: z
    .string()
    .length(32)
    .describe("The user ID to ban")
    .openapi({ example: "123e4567e89b12d3a456426614174000" }),
  reason: z.string().min(1).describe("Reason for the ban").openapi({
    example: "Toxic behaviour",
  }),
  expiresAt: z
    .number()
    .int()
    .positive()
    .nullable()
    .optional()
    .describe("Timestamp when the ban expires or null for permanent")
    .openapi({ example: 1740325296918 }),
});

export type BanUserRequest = z.infer<typeof BanUserRequestSchema>;

export const UnbanUserRequestSchema = z.object({
  userId: z
    .string()
    .length(32)
    .describe("The user ID to unban")
    .openapi({ example: "123e4567e89b12d3a456426614174000" }),
});

export type UnbanUserRequest = z.infer<typeof UnbanUserRequestSchema>;
