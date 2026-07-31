import {
  pgTable,
  varchar,
  text,
  timestamp,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { authenticatedUserRole } from "../rls.ts";

export const deviceAuthorizationCodesTable = pgTable.withRLS(
  "device_authorization_codes",
  {
    code: varchar("code", { length: 16 }).primaryKey(),
    encryptedTokens: text("encrypted_tokens"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    pgPolicy("device_authorization_codes_all_insert", {
      for: "insert",
      to: authenticatedUserRole,
      withCheck: sql`true`,
    }),
    pgPolicy("device_authorization_codes_all_update", {
      for: "update",
      to: authenticatedUserRole,
      using: sql`true`,
      withCheck: sql`true`,
    }),
    pgPolicy("device_authorization_codes_all_delete", {
      for: "delete",
      to: authenticatedUserRole,
      using: sql`true`,
    }),
  ],
);

export type DeviceAuthorizationCodeEntity =
  typeof deviceAuthorizationCodesTable.$inferSelect;
export type DeviceAuthorizationCodeInsertEntity =
  typeof deviceAuthorizationCodesTable.$inferInsert;
