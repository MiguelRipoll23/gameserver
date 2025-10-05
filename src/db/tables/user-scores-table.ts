import { pgTable, integer, uuid, serial } from "drizzle-orm/pg-core";
import { usersTable } from "./users-table.ts";

export const userScoresTable = pgTable("user_scores", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  totalScore: integer("total_score").notNull().default(0),
});

export type UserScoreEntity = typeof userScoresTable.$inferSelect;
export type UserScoreInsertEntity = typeof userScoresTable.$inferInsert;
