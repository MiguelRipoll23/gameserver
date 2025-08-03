import { pgTable, uuid, varchar, boolean, serial } from "drizzle-orm/pg-core";
import { usersTable } from "./users-table.ts";

export const userReportsTable = pgTable("user_reports", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  reason: varchar("reason").notNull(),
  automatic: boolean("automatic").notNull().default(false),
});
