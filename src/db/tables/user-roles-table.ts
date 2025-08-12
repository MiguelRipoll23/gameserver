import { pgTable, timestamp, uuid, primaryKey } from "drizzle-orm/pg-core";
import { usersTable } from "./users-table.ts";
import { rolesTable } from "./roles-table.ts";

export const userRolesTable = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => rolesTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.userId, table.roleId] }),
    };
  }
);

export type UserRoleEntity = typeof userRolesTable.$inferSelect;
export type UserRoleInsertEntity = typeof userRolesTable.$inferInsert;
