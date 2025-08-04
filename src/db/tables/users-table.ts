import { pgTable, varchar, timestamp } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: varchar("id").primaryKey(),
  displayName: varchar("display_name", { length: 16 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type UserEntity = typeof usersTable.$inferSelect;
export type UserInsertEntity = typeof usersTable.$inferInsert;
