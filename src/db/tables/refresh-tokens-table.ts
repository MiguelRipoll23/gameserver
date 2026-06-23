import {
  pgTable,
  varchar,
  uuid,
  integer,
  timestamp,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users-table.ts";
import { authenticatedUserRole, isCurrentUser } from "../rls.ts";

export const refreshTokensTable = pgTable.withRLS(
  "refresh_tokens",
  {
    tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    tokenVersion: integer("token_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    pgPolicy("refresh_tokens_select_own", {
      for: "select",
      to: authenticatedUserRole,
      using: isCurrentUser(table.userId),
    }),
    pgPolicy("refresh_tokens_insert_own", {
      for: "insert",
      to: authenticatedUserRole,
      withCheck: isCurrentUser(table.userId),
    }),
    pgPolicy("refresh_tokens_delete_own", {
      for: "delete",
      to: authenticatedUserRole,
      using: isCurrentUser(table.userId),
    }),
  ],
);

export type RefreshTokenEntity = typeof refreshTokensTable.$inferSelect;
export type RefreshTokenInsertEntity = typeof refreshTokensTable.$inferInsert;
