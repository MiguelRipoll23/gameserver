import {
  integer,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users-table.ts";

export const matchesTable = pgTable("matches", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  hostUserId: uuid("host_user_id")
    .notNull()
    .unique()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  clientVersion: varchar("client_version", { length: 16 }).notNull(),
  totalSlots: integer("total_slots").notNull(),
  availableSlots: integer("available_slots").notNull(),
  pingMedianMilliseconds: integer("ping_median_milliseconds")
    .default(0)
    .notNull(),
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
