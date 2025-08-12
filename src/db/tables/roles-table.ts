import { pgTable, varchar, timestamp, uuid } from "drizzle-orm/pg-core";

export const rolesTable = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 50 }).notNull().unique(),
  description: varchar("description", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type RoleEntity = typeof rolesTable.$inferSelect;
export type RoleInsertEntity = typeof rolesTable.$inferInsert;
