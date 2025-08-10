import { pgTable, varchar, timestamp, uuid, inet } from "drizzle-orm/pg-core";
import { usersTable } from "./users-table.ts";

export const userSessionsTable = pgTable("user_sessions", {
  id: varchar("id", { length: 44 }).primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  publicIp: inet("public_ip").notNull(),
  country: varchar("country"), // will be obtained from public ip later
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type UserSessionEntity = typeof userSessionsTable.$inferSelect;
export type UserSessionInsertEntity = typeof userSessionsTable.$inferInsert;
