import {
  integer,
  pgTable,
  timestamp,
  uuid,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users-table.ts";
import { rolesTable } from "./roles-table.ts";

export const userRolesTable = pgTable(
  "user_roles",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    roleId: integer("role_id")
      .notNull()
      .references(() => rolesTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("user_roles_user_id_role_id_idx").on(table.userId, table.roleId),
    index("user_roles_user_id_idx").on(table.userId),
  ]
);

export type UserRoleEntity = typeof userRolesTable.$inferSelect;
export type UserRoleInsertEntity = typeof userRolesTable.$inferInsert;
