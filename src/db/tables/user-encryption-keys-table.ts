import {
  pgTable,
  varchar,
  uuid,
  timestamp,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users-table.ts";
import { authenticatedUserRole, isCurrentUser } from "../rls.ts";

export const userEncryptionKeysTable = pgTable.withRLS(
  "user_encryption_keys",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    pgPolicy("user_encryption_keys_select_own", {
      for: "select",
      to: authenticatedUserRole,
      using: isCurrentUser(table.userId),
    }),
    pgPolicy("user_encryption_keys_insert_own", {
      for: "insert",
      to: authenticatedUserRole,
      withCheck: isCurrentUser(table.userId),
    }),
    pgPolicy("user_encryption_keys_update_own", {
      for: "update",
      to: authenticatedUserRole,
      using: isCurrentUser(table.userId),
      withCheck: isCurrentUser(table.userId),
    }),
    pgPolicy("user_encryption_keys_delete_own", {
      for: "delete",
      to: authenticatedUserRole,
      using: isCurrentUser(table.userId),
    }),
  ],
);

export type UserEncryptionKeyEntity =
  typeof userEncryptionKeysTable.$inferSelect;
export type UserEncryptionKeyInsertEntity =
  typeof userEncryptionKeysTable.$inferInsert;
