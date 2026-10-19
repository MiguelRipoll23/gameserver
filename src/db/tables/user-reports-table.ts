import {
  integer,
  pgPolicy,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users-table.ts";
import { authenticatedUserRole, isCurrentUser } from "../rls.ts";

/**
 * A report filed by a human player against another player.
 *
 * `issuedBy` is the reporting player; `userId` is the reported player.
 * Display names are joined from `users` at query time.
 */
export const userReportsManualTable = pgTable.withRLS(
  "user_reports_manual",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    issuedBy: uuid("issued_by_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    reason: varchar("reason", { length: 500 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    // Users can read the reports filed against them.
    pgPolicy("user_reports_manual_select_own", {
      for: "select",
      to: authenticatedUserRole,
      using: isCurrentUser(table.userId),
    }),
  ],
);

export type UserReportManualEntity =
  typeof userReportsManualTable.$inferSelect;
export type UserReportManualInsertEntity =
  typeof userReportsManualTable.$inferInsert;

/**
 * A report generated automatically by the game client's anti-cheat system.
 *
 * `userId` is the violating player; `issuedBy` is the host that detected the
 * violation (nullable when no host is attributable); `ruleId` is the rule that
 * was broken. There is deliberately no free-text `reason` — the rule carries
 * the machine-readable detail.
 */
export const userReportsAutomaticTable = pgTable.withRLS(
  "user_reports_automatic",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    issuedBy: uuid("issued_by_user_id").references(() => usersTable.id, {
      onDelete: "cascade",
    }),
    ruleId: integer("rule_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    // Users can read the automatic reports filed against them.
    pgPolicy("user_reports_automatic_select_own", {
      for: "select",
      to: authenticatedUserRole,
      using: isCurrentUser(table.userId),
    }),
  ],
);

export type UserReportAutomaticEntity =
  typeof userReportsAutomaticTable.$inferSelect;
export type UserReportAutomaticInsertEntity =
  typeof userReportsAutomaticTable.$inferInsert;
