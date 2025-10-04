import {
  pgTable,
  varchar,
  integer,
  boolean,
  jsonb,
  text,
  uuid,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users-table.ts";

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
  (table) => [index("user_credentials_user_id_idx").on(table.userId)]
);

export type UserCredentialEntity = typeof userCredentialsTable.$inferSelect;
export type UserCredentialInsertEntity =
  typeof userCredentialsTable.$inferInsert;
