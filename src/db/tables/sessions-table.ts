import { pgTable, varchar, uuid, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users-table.ts";

export const userSessionsTable = pgTable("userSessions", {
  id: varchar("id", { length: 32 }).primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
