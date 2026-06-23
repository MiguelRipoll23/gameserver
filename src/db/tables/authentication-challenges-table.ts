import {
  pgTable,
  serial,
  uuid,
  varchar,
  jsonb,
  timestamp,
  unique,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { authenticatedUserRole } from "../rls.ts";

export const authenticationChallengesTable = pgTable(
  "authentication_challenges",
  {
    id: serial("id").primaryKey(),
    transactionId: uuid("transaction_id").notNull(),
    type: varchar("type", { length: 32 }).notNull(),
    data: jsonb("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique().on(table.transactionId, table.type),
    pgPolicy("authentication_challenges_all_insert", {
      for: "insert",
      to: authenticatedUserRole,
      withCheck: sql`true`,
    }),
    pgPolicy("authentication_challenges_all_select", {
      for: "select",
      to: authenticatedUserRole,
      using: sql`true`,
    }),
    pgPolicy("authentication_challenges_all_delete", {
      for: "delete",
      to: authenticatedUserRole,
      using: sql`true`,
    }),
  ],
);

export type AuthenticationChallengeEntity =
  typeof authenticationChallengesTable.$inferSelect;
export type AuthenticationChallengeInsertEntity =
  typeof authenticationChallengesTable.$inferInsert;
