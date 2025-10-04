import {
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users-table.ts";
import { authenticatedUserRole, isCurrentUser } from "../rls.ts";

export const userBansTable = pgTable(
  "user_bans",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    reason: varchar("reason", { length: 500 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (table) => [
    // Users can read their own ban records
    pgPolicy("user_bans_select_own", {
      for: "select",
      to: authenticatedUserRole,
      using: isCurrentUser(table.userId),
    }),
  ]
);

export type UserBanEntity = typeof userBansTable.$inferSelect;
export type UserBanInsertEntity = typeof userBansTable.$inferInsert;
