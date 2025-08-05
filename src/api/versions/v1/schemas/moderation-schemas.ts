import { z } from "@hono/zod-openapi";

export const BanDurationSchema = z
  .object({
    value: z
      .number()
      .int()
      .min(1)
      .max(60)
      .describe("Value of the ban duration")
      .openapi({ example: 1 }),
    unit: z
      .enum(["minutes", "hours", "days", "weeks", "months", "years"])
      .describe("Unit of the ban duration")
      .openapi({ example: "hours" }),
  })
  .refine(
    (d) => {
      switch (d.unit) {
        case "minutes":
          return d.value <= 59;
        case "hours":
          return d.value <= 23;
        case "days":
          return d.value <= 7;
        case "weeks":
          return d.value <= 4;
        case "months":
          return d.value <= 12;
        case "years":
          return d.value <= 5;
        default:
          return true;
      }
    },
    {
      message: "Duration value exceeds allowed range for unit",
    }
  );

export type BanDuration = z.infer<typeof BanDurationSchema>;

export const BanUserRequestSchema = z.object({
  userId: z
    .string()
    .length(36)
    .describe("The user ID to ban")
    .openapi({ example: "00000000-00000000-00000000-00000000" }),
  reason: z.string().min(1).max(100).describe("Reason for the ban").openapi({
    example: "Toxic behaviour",
  }),
  duration: BanDurationSchema.optional().describe(
    "Duration of the ban. If omitted the ban is permanent"
  ),
});

export type BanUserRequest = z.infer<typeof BanUserRequestSchema>;

export const UnbanUserRequestSchema = z.object({
  userId: z
    .string()
    .length(36)
    .describe("The user ID to unban")
    .openapi({ example: "00000000-00000000-00000000-00000000" }),
});

export type UnbanUserRequest = z.infer<typeof UnbanUserRequestSchema>;

export const ReportUserRequestSchema = z.object({
  userId: z
    .string()
    .length(36)
    .describe("The user ID to report")
    .openapi({ example: "00000000-00000000-00000000-00000000" }),
  reason: z
    .string()
    .min(1)
    .max(100)
    .describe("Reason for the report")
    .openapi({ example: "Offensive language" }),
  automatic: z
    .boolean()
    .describe("Defines if the game client reported this automatically")
    .openapi({ example: false }),
});

export type ReportUserRequest = z.infer<typeof ReportUserRequestSchema>;
