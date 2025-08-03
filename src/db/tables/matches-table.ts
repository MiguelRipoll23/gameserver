import {
  pgTable,
  serial,
  varchar,
  uuid,
  integer,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users-table.ts";
import { userSessionsTable } from "./user-sessions-table.ts";

export const matchesTable = pgTable("matches", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id")
    .notNull()
    .references(() => userSessionsTable.id, { onDelete: "cascade" }),
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
