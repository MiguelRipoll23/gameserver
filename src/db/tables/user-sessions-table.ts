import { pgTable, varchar, timestamp, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users-table.ts";

export const userSessionsTable = pgTable("user_sessions", {
  id: varchar("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  publicIp: varchar("public_ip").notNull(),
  country: varchar("country"), // will be obtained from public ip later
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type UserSessionEntity = typeof userSessionsTable.$inferSelect;
export type UserSessionInsertEntity = typeof userSessionsTable.$inferInsert;
