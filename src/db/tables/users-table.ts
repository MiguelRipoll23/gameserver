import {
  pgTable,
  varchar,
  timestamp,
  uuid,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { authenticatedUserRole, isCurrentUser } from "../rls.ts";

export const usersTable = pgTable(
  "users",
  {
    id: uuid("id").primaryKey(),
    displayName: varchar("display_name", { length: 16 }).notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Users can read their own user record
    pgPolicy("users_select_own", {
      for: "select",
      to: authenticatedUserRole,
      using: isCurrentUser(table.id),
    }),
    // Users can update their own user record
    pgPolicy("users_update_own", {
      for: "update",
      to: authenticatedUserRole,
      using: isCurrentUser(table.id),
      withCheck: isCurrentUser(table.id),
    }),
  ]
);

export type UserEntity = typeof usersTable.$inferSelect;
export type UserInsertEntity = typeof usersTable.$inferInsert;
