import {
  pgTable,
  jsonb,
  timestamp,
  integer,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const serverSignatureKeysTable = pgTable(
  "server_signature_keys",
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
    check("server_signature_keys_singleton", sql`${table.id} = 1`),
  ],
);

export type ServerSignatureKeyEntity =
  typeof serverSignatureKeysTable.$inferSelect;
export type ServerSignatureKeyInsertEntity =
  typeof serverSignatureKeysTable.$inferInsert;
