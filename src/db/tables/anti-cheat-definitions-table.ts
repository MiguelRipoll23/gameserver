import {
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Display metadata for anti-cheat rules, keyed by the numeric identifiers
 * that mirror the game client's anti-cheat enums.
 *
 * Each row is one human-readable label/description/hint for the management
 * console. `kind` discriminates the five maps the console renders:
 *   - `ruleType`:  key = rule type id          -> { label, description }
 *   - `ruleField`: key = field id, parentKey = rule type id -> { label, hint }
 *   - `eventName` / `entityName` / `valueType`: key = numeric id -> { label }
 *
 * Management-only read data seeded by migration, so no RLS policies are
 * needed (mirrors `anticheat_rules` / `blocked_words`).
 */
export const antiCheatDefinitionsTable = pgTable(
  "anticheat_definitions",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    kind: varchar("kind", { length: 32 }).notNull(),
    // Numeric identifier as a string (e.g. "0", "20"), matching the JSON keys
    // the console maps back to numbers.
    key: varchar("key", { length: 32 }).notNull(),
    // For hierarchical entries only (rule fields); empty string otherwise so
    // the unique index also covers the flat kinds.
    parentKey: varchar("parent_key", { length: 32 }).notNull().default(""),
    label: text("label").notNull(),
    description: text("description"),
    hint: text("hint"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    uniqueDefinition: uniqueIndex("anticheat_definitions_unique_entry").on(
      table.kind,
      table.key,
      table.parentKey,
    ),
  }),
);

export type AntiCheatDefinitionEntity =
  typeof antiCheatDefinitionsTable.$inferSelect;
export type AntiCheatDefinitionInsertEntity =
  typeof antiCheatDefinitionsTable.$inferInsert;
