import { jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const registrationOptionsTable = pgTable("registration_options", {
  transactionId: varchar("transaction_id", { length: 255 }).primaryKey(),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type RegistrationOptionsEntity =
  typeof registrationOptionsTable.$inferSelect;
export type RegistrationOptionsInsertEntity =
  typeof registrationOptionsTable.$inferInsert;
