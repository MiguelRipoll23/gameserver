import {
  boolean,
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users-table.ts";

export const userReportsTable = pgTable("user_reports", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  reporterUserId: uuid("reporter_user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  reportedUserId: uuid("reported_user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  reason: varchar("reason", { length: 500 }).notNull(),
  automatic: boolean("automatic").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export type UserReportEntity = typeof userReportsTable.$inferSelect;
export type UserReportInsertEntity = typeof userReportsTable.$inferInsert;
