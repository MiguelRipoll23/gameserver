import { jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const authenticationOptionsTable = pgTable("authentication_options", {
  transactionId: varchar("transaction_id", { length: 255 }).primaryKey(),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type AuthenticationOptionsEntity =
  typeof authenticationOptionsTable.$inferSelect;
export type AuthenticationOptionsInsertEntity =
  typeof authenticationOptionsTable.$inferInsert;
