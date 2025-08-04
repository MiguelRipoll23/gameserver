import { pgTable, varchar, uuid, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users-table.ts";

export const userSessionsTable = pgTable("user_sessions", {
  id: varchar("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type UserSessionEntity = typeof userSessionsTable.$inferSelect;
export type UserSessionInsertEntity = typeof userSessionsTable.$inferInsert;
