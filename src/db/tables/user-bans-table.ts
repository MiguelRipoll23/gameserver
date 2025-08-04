import { pgTable, serial, timestamp, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users-table.ts";

export const userBansTable = pgTable("user_bans", {
  id: serial("id").primaryKey(),
  userId: uuid("id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export type UserBanEntity = typeof userBansTable.$inferSelect;
export type UserBanInsertEntity = typeof userBansTable.$inferInsert;
