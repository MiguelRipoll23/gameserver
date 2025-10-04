import {
  pgTable,
  varchar,
  integer,
  boolean,
  jsonb,
  text,
  uuid,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users-table.ts";
import {
  authenticatedUserRole,
  isCurrentUser,
  isCurrentCredential,
} from "../rls.ts";

export const userCredentialsTable = pgTable(
  "user_credentials",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    publicKey: text("public_key").notNull(), // store base64-encoded string
    counter: integer("counter").notNull(),
    deviceType: varchar("device_type", { length: 32 }).notNull(),
    backupStatus: boolean("backup_status").notNull(),
    transports: jsonb("transports"), // string[] or undefined
  },
  (table) => [
    // Users can read their own credentials
    pgPolicy("user_credentials_select_own", {
      for: "select",
      to: authenticatedUserRole,
      using: isCurrentUser(table.userId),
    }),
    // Allow access by credential ID (for authentication flows)
    pgPolicy("user_credentials_select_by_credential", {
      for: "select",
      to: authenticatedUserRole,
      using: isCurrentCredential(table.id),
    }),
    // Users can insert their own credentials
    pgPolicy("user_credentials_insert_own", {
      for: "insert",
      to: authenticatedUserRole,
      withCheck: isCurrentUser(table.userId),
    }),
    // Users can update their own credentials
    pgPolicy("user_credentials_update_own", {
      for: "update",
      to: authenticatedUserRole,
      using: isCurrentUser(table.userId),
      withCheck: isCurrentUser(table.userId),
    }),
    // Allow update by credential ID (for counter updates during authentication)
    pgPolicy("user_credentials_update_by_credential", {
      for: "update",
      to: authenticatedUserRole,
      using: isCurrentCredential(table.id),
      withCheck: isCurrentCredential(table.id),
    }),
    // Users can delete their own credentials
    pgPolicy("user_credentials_delete_own", {
      for: "delete",
      to: authenticatedUserRole,
      using: isCurrentUser(table.userId),
    }),
  ]
);

export type UserCredentialEntity = typeof userCredentialsTable.$inferSelect;
export type UserCredentialInsertEntity =
  typeof userCredentialsTable.$inferInsert;
