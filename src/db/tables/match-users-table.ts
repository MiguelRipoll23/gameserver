import {
  integer,
  pgTable,
  uuid,
  index,
} from "drizzle-orm/pg-core";
import { matchesTable } from "./matches-table.ts";
import { usersTable } from "./users-table.ts";

export const matchUsersTable = pgTable(
  "match_users",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    matchId: integer("match_id")
      .notNull()
      .references(() => matchesTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
  },
  (table) => ({
    matchUsersMatchIdUserIdIdx: index("match_users_match_id_user_id_idx").on(
      table.matchId,
      table.userId,
    ),
    matchUsersUserIdIdx: index("match_users_user_id_idx").on(table.userId),
  }),
);

export type MatchUserEntity = typeof matchUsersTable.$inferSelect;
export type MatchUserInsertEntity = typeof matchUsersTable.$inferInsert;
