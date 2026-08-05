import {
  pgTable,
  varchar,
  text,
  uuid,
  timestamp,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users-table.ts";
import { authenticatedUserRole, isCurrentUser } from "../rls.ts";

export const botsTable = pgTable.withRLS(
  "bots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 32 }).notNull().unique(),
    description: text("description"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Bot creators can read their own bots
    pgPolicy("bots_select_own", {
      for: "select",
      to: authenticatedUserRole,
      using: isCurrentUser(table.createdBy),
    }),
    // Bot creators can create their own bots
    pgPolicy("bots_insert_own", {
      for: "insert",
      to: authenticatedUserRole,
      withCheck: isCurrentUser(table.createdBy),
    }),
    // Bot creators can update their own bots
    pgPolicy("bots_update_own", {
      for: "update",
      to: authenticatedUserRole,
      using: isCurrentUser(table.createdBy),
      withCheck: isCurrentUser(table.createdBy),
    }),
    // Bot creators can delete their own bots
    pgPolicy("bots_delete_own", {
      for: "delete",
      to: authenticatedUserRole,
      using: isCurrentUser(table.createdBy),
    }),
  ],
);

export type BotEntity = typeof botsTable.$inferSelect;
export type BotInsertEntity = typeof botsTable.$inferInsert;
