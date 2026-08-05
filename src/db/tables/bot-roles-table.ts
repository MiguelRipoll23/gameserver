import {
  integer,
  pgTable,
  timestamp,
  uuid,
  unique,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { botsTable } from "./bots-table.ts";
import { rolesTable } from "./roles-table.ts";
import { authenticatedUserRole } from "../rls.ts";

export const botRolesTable = pgTable.withRLS(
  "bot_roles",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    botId: uuid("bot_id")
      .notNull()
      .references(() => botsTable.id, { onDelete: "cascade" }),
    roleId: integer("role_id")
      .notNull()
      .references(() => rolesTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("bot_roles_bot_id_role_id_idx").on(table.botId, table.roleId),
    // Bot creators can read only their own bot role assignments
    pgPolicy("bot_roles_select_own", {
      for: "select",
      to: authenticatedUserRole,
      using: sql`(current_setting('app.user_id', true)::uuid = (SELECT ${botsTable.createdBy} FROM ${botsTable} WHERE ${botsTable.id} = ${table.botId}))`,
    }),
  ],
);

export type BotRoleEntity = typeof botRolesTable.$inferSelect;
export type BotRoleInsertEntity = typeof botRolesTable.$inferInsert;