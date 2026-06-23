import {
  pgTable,
  jsonb,
  timestamp,
  integer,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { authenticatedUserRole } from "../rls.ts";

export const userSignatureKeysTable = pgTable(
  "user_signature_keys",
  {
    id: integer("id").primaryKey().default(1),
    privateKey: jsonb("private_key").notNull(),
    publicKey: jsonb("public_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    pgPolicy("user_signature_keys_all_insert", {
      for: "insert",
      to: authenticatedUserRole,
      withCheck: sql`true`,
    }),
    pgPolicy("user_signature_keys_all_select", {
      for: "select",
      to: authenticatedUserRole,
      using: sql`true`,
    }),
    pgPolicy("user_signature_keys_all_update", {
      for: "update",
      to: authenticatedUserRole,
      using: sql`true`,
      withCheck: sql`true`,
    }),
  ],
);

export type UserSignatureKeyEntity =
  typeof userSignatureKeysTable.$inferSelect;
export type UserSignatureKeyInsertEntity =
  typeof userSignatureKeysTable.$inferInsert;
