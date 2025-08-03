import { pgTable, uuid, varchar, integer } from "drizzle-orm/pg-core";
import { usersTable } from "./users-table.ts";

export const userScoresTable = pgTable("user_scores", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  userDisplayName: varchar("user_display_name", { length: 16 }).notNull(),
  totalScore: integer("total_score").notNull().default(0),
});
