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
  duration: z
    .string()
    .regex(/^[1-9]\d*(min|h|d|w|m|y)$/)
    .optional()
    .describe(
      "Relative ban duration. Use 'min' for minutes, 'h' for hours, 'd' for days, 'w' for weeks, 'm' for months and 'y' for years",
    )
    .openapi({ example: "1h" }),
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
