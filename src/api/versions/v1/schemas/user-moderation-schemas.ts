import { z } from "@hono/zod-openapi";
import { PaginatedResponseSchema } from "./pagination-schemas.ts";

export const BanDurationSchema = z
  .object({
    value: z
      .number()
      .int()
      .min(1)
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
    .openapi({ example: "00000000-0000-0000-0000-000000000000" }),
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
    .openapi({ example: "00000000-0000-0000-0000-000000000000" }),
});

export type UnbanUserRequest = z.infer<typeof UnbanUserRequestSchema>;

export const ReportUserRequestSchema = z.object({
  userId: z
    .string()
    .length(36)
    .describe("The user ID to report")
    .openapi({ example: "00000000-0000-0000-0000-000000000000" }),
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

export const GetUserBansRequestSchema = z.object({
  userId: z
    .string()
    .length(36)
    .describe("The user ID to get bans for")
    .openapi({ example: "00000000-0000-0000-0000-000000000000" }),
  cursor: z
    .number()
    .optional()
    .describe("Cursor for pagination (ID of last item from previous page)"),
  limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .describe("Maximum number of items to return")
    .openapi({ example: 20 }),
});

export type GetUserBansRequest = z.infer<typeof GetUserBansRequestSchema>;

export const UserBanResponseSchema = z.object({
  id: z.number().describe("Ban ID"),
  userId: z.string().describe("User ID"),
  reason: z.string().describe("Ban reason"),
  createdAt: z.string().describe("Ban creation date"),
  updatedAt: z.string().nullable().describe("Ban update date"),
  expiresAt: z.string().nullable().describe("Ban expiration date"),
});

export type UserBanResponse = z.infer<typeof UserBanResponseSchema>;

export const GetUserBansResponseSchema = PaginatedResponseSchema(
  UserBanResponseSchema
);

export type GetUserBansResponse = z.infer<typeof GetUserBansResponseSchema>;

export const GetUserReportsRequestSchema = z.object({
  userId: z
    .string()
    .length(36)
    .describe("The user ID to get reports for")
    .openapi({ example: "00000000-0000-0000-0000-000000000000" }),
  cursor: z
    .number()
    .optional()
    .describe("Cursor for pagination (ID of last item from previous page)"),
  limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .describe("Maximum number of items to return")
    .openapi({ example: 20 }),
});

export type GetUserReportsRequest = z.infer<typeof GetUserReportsRequestSchema>;

export const UserReportResponseSchema = z.object({
  id: z.number().describe("Report ID"),
  reporterUserId: z.string().describe("Reporter user ID"),
  reportedUserId: z.string().describe("Reported user ID"),
  reason: z.string().describe("Report reason"),
  automatic: z.boolean().describe("Whether the report was automatic"),
});

export type UserReportResponse = z.infer<typeof UserReportResponseSchema>;

export const GetUserReportsResponseSchema = PaginatedResponseSchema(
  UserReportResponseSchema
);

export type GetUserReportsResponse = z.infer<
  typeof GetUserReportsResponseSchema
>;
