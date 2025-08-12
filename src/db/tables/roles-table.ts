import { pgTable, varchar, timestamp, integer } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const rolesTable = pgTable("roles", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 50 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => sql`now()`),
});

export type RoleEntity = typeof rolesTable.$inferSelect;
export type RoleInsertEntity = typeof rolesTable.$inferInsert;
