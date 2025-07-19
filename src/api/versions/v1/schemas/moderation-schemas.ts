import { z } from "@hono/zod-openapi";

export const BanUserRequestSchema = z.object({
  userId: z
    .string()
    .length(32)
    .describe("The user ID to ban")
    .openapi({ example: "123e4567e89b12d3a456426614174000" }),
  reason: z
    .string()
    .min(1)
    .max(100)
    .describe("Reason for the ban")
    .openapi({
      example: "Toxic behaviour",
    }),
  duration: z
    .string()
    .regex(/^[1-9]\d*(?:mo|m|h|d|w|y)$/)
    .optional()
    .describe(
      `Relative ban duration. Supported units:\n- 'm' for minutes\n- 'h' for hours\n- 'd' for days\n- 'w' for weeks\n- 'mo' for months\n- 'y' for years`,
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
