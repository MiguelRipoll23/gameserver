import {
  pgTable,
  varchar,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";

export const gameConfigurationTable = pgTable("game_configuration", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type GameConfigurationEntity =
  typeof gameConfigurationTable.$inferSelect;
export type GameConfigurationInsertEntity =
  typeof gameConfigurationTable.$inferInsert;
