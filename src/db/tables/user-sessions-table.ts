import {
  pgTable,
  varchar,
  timestamp,
  uuid,
  inet,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users-table.ts";
import { authenticatedUserRole, isCurrentUser } from "../rls.ts";

export const userSessionsTable = pgTable(
  "user_sessions",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    token: varchar("token", { length: 44 }).notNull().unique(),
    publicIp: inet("public_ip").notNull(),
    country: varchar("country"), // will be obtained from public ip later
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Users can read their own sessions
    pgPolicy("user_sessions_select_own", {
      for: "select",
      to: authenticatedUserRole,
      using: isCurrentUser(table.userId),
    }),
    // Users can insert their own sessions
    pgPolicy("user_sessions_insert_own", {
      for: "insert",
      to: authenticatedUserRole,
      withCheck: isCurrentUser(table.userId),
    }),
    // Users can update their own sessions
    pgPolicy("user_sessions_update_own", {
      for: "update",
      to: authenticatedUserRole,
      using: isCurrentUser(table.userId),
      withCheck: isCurrentUser(table.userId),
    }),
    // Users can delete their own sessions
    pgPolicy("user_sessions_delete_own", {
      for: "delete",
      to: authenticatedUserRole,
      using: isCurrentUser(table.userId),
    }),
  ]
);

export type UserSessionEntity = typeof userSessionsTable.$inferSelect;
export type UserSessionInsertEntity = typeof userSessionsTable.$inferInsert;
