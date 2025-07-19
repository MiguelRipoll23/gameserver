import { z } from "@hono/zod-openapi";

export const BanUserRequestSchema = z
  .object({
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
      .openapi({ example: "Toxic behaviour" }),
    durationValue: z
      .number()
      .int()
      .min(1)
      .max(45)
      .optional()
      .describe("Duration value")
      .openapi({ example: 1 }),
    durationUnit: z
      .enum(["minutes", "hours", "weeks", "months", "years"])
      .optional()
      .describe(
        `Duration unit. Supported units:\n- 'minutes'\n- 'hours'\n- 'weeks'\n- 'months'\n- 'years'`,
      )
      .openapi({ example: "hours" }),
  })
  .refine(
    (data) =>
      (data.durationValue === undefined && data.durationUnit === undefined) ||
      (data.durationValue !== undefined && data.durationUnit !== undefined),
    {
      message: "durationValue and durationUnit must be provided together",
      path: ["durationValue"],
    },
  );

export type BanUserRequest = z.infer<typeof BanUserRequestSchema>;

export const UnbanUserRequestSchema = z.object({
  userId: z
    .string()
    .length(32)
    .describe("The user ID to unban")
    .openapi({ example: "123e4567e89b12d3a456426614174000" }),
});

export type UnbanUserRequest = z.infer<typeof UnbanUserRequestSchema>;
