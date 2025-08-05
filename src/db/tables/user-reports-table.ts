import { pgTable, varchar, integer, boolean, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users-table.ts";

export const userReportsTable = pgTable("user_reports", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  reason: varchar("reason", { length: 500 }).notNull(),
  automatic: boolean("automatic").notNull().default(false),
});

export type UserReportEntity = typeof userReportsTable.$inferSelect;
export type UserReportInsertEntity = typeof userReportsTable.$inferInsert;
