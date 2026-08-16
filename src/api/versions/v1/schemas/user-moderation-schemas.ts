import { z } from "@hono/zod-openapi";
import {
  PaginatedResponseSchema,
  PaginationSchema,
} from "./pagination-schemas.ts";

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
    },
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
    "Duration of the ban. If omitted the ban is permanent",
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

export const ManualReportUserRequestSchema = z.object({
  userId: z
    .string()
    .length(36)
    .describe("The user ID to report")
    .openapi({ example: "00000000-0000-0000-0000-000000000000" }),
  reason: z
    .string()
    .min(1)
    .max(500)
    .describe("Reason for the report")
    .openapi({ example: "Offensive language" }),
});

export type ManualReportUserRequest = z.infer<
  typeof ManualReportUserRequestSchema
>;

export const AutomaticReportUserRequestSchema = z.object({
  userId: z
    .string()
    .length(36)
    .describe("The user ID the anti-cheat system detected")
    .openapi({ example: "00000000-0000-0000-0000-000000000000" }),
  ruleId: z
    .number()
    .int()
    .min(0)
    .max(65535)
    .describe("The anti-cheat rule that was broken")
    .openapi({ example: 1 }),
});

export type AutomaticReportUserRequest = z.infer<
  typeof AutomaticReportUserRequestSchema
>;

export const GetUserBansQuerySchema = PaginationSchema.extend({
  userId: z
    .string()
    .length(36)
    .optional()
    .describe("The user ID to get bans for. If omitted, returns bans for all users")
    .openapi({ example: "00000000-0000-0000-0000-000000000000" }),
});

export const GetUserBansRequestSchema = GetUserBansQuerySchema;

export type GetUserBansRequest = z.infer<typeof GetUserBansRequestSchema>;

export const UserBanResponseSchema = z.object({
  userId: z.string().describe("Banned user ID"),
  userDisplayName: z.string().describe("Display name of the banned user"),
  issuedByUserId: z
    .string()
    .nullable()
    .describe("ID of the user who issued the ban"),
  issuedByUserDisplayName: z
    .string()
    .nullable()
    .describe("Display name of the user who issued the ban"),
  reason: z.string().describe("Ban reason"),
  createdAt: z.string().describe("Ban creation date"),
  updatedAt: z.string().nullable().describe("Ban update date"),
  expiresAt: z.string().nullable().describe("Ban expiration date"),
});

export type UserBanResponse = z.infer<typeof UserBanResponseSchema>;

export const GetUserBansResponseSchema = PaginatedResponseSchema(
  UserBanResponseSchema,
);

export type GetUserBansResponse = z.infer<typeof GetUserBansResponseSchema>;

export const GetUserReportsManualQuerySchema = PaginationSchema.extend({
  userId: z
    .string()
    .length(36)
    .optional()
    .describe("The user ID to get reports for. If omitted, returns reports for all users")
    .openapi({ example: "00000000-0000-0000-0000-000000000000" }),
});

export type GetUserReportsManualRequest = z.infer<
  typeof GetUserReportsManualQuerySchema
>;

export const GetUserReportsAutomaticQuerySchema = PaginationSchema.extend({
  userId: z
    .string()
    .length(36)
    .optional()
    .describe("The user ID to get automatic reports for. If omitted, returns reports for all users")
    .openapi({ example: "00000000-0000-0000-0000-000000000000" }),
});

export type GetUserReportsAutomaticRequest = z.infer<
  typeof GetUserReportsAutomaticQuerySchema
>;

export const UserReportResponseSchema = z.object({
  userId: z.string().describe("Reported user ID"),
  userDisplayName: z.string().describe("Display name of the reported user"),
  issuedByUserId: z
    .string()
    .describe("ID of the user who issued the report"),
  issuedByUserDisplayName: z
    .string()
    .describe("Display name of the user who issued the report"),
  reason: z.string().describe("Report reason"),
  createdAt: z.string().describe("Report creation date"),
  updatedAt: z.string().nullable().describe("Report update date"),
});

export type UserReportResponse = z.infer<typeof UserReportResponseSchema>;

export const GetUserReportsManualResponseSchema = PaginatedResponseSchema(
  UserReportResponseSchema,
);

export type GetUserReportsManualResponse = z.infer<
  typeof GetUserReportsManualResponseSchema
>;

export const AutomaticUserReportResponseSchema = z.object({
  userId: z.string().describe("Reported user ID"),
  userDisplayName: z.string().describe("Display name of the reported user"),
  issuedByUserId: z
    .string()
    .nullable()
    .describe("ID of the host that detected the violation"),
  issuedByUserDisplayName: z
    .string()
    .nullable()
    .describe("Display name of the host that detected the violation"),
  ruleId: z.number().int().describe("The anti-cheat rule that was broken"),
  createdAt: z.string().describe("Report creation date"),
  updatedAt: z.string().nullable().describe("Report update date"),
});

export type AutomaticUserReportResponse = z.infer<
  typeof AutomaticUserReportResponseSchema
>;

export const GetUserReportsAutomaticResponseSchema = PaginatedResponseSchema(
  AutomaticUserReportResponseSchema,
);

export type GetUserReportsAutomaticResponse = z.infer<
  typeof GetUserReportsAutomaticResponseSchema
>;
