import {
  integer,
  pgTable,
  uuid,
} from "drizzle-orm/pg-core";
import { matchesTable } from "./matches-table.ts";
import { usersTable } from "./users-table.ts";

export const matchPlayersTable = pgTable("match_players", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  matchId: integer("match_id")
    .notNull()
    .references(() => matchesTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
});

export type MatchPlayerEntity = typeof matchPlayersTable.$inferSelect;
export type MatchPlayerInsertEntity = typeof matchPlayersTable.$inferInsert;
