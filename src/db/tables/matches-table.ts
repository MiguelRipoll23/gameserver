import {
  pgTable,
  varchar,
  integer,
  jsonb,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users-table.ts";

export const matchesTable = pgTable("matches", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  hostUserId: uuid("host_user_id")
    .notNull()
    .unique()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  version: varchar("version", { length: 16 }).notNull(),
  totalSlots: integer("total_slots").notNull(),
  availableSlots: integer("available_slots").notNull(),
  attributes: jsonb("attributes").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type MatchEntity = typeof matchesTable.$inferSelect;
export type MatchInsertEntity = typeof matchesTable.$inferInsert;
