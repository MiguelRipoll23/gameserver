import {
  integer,
  jsonb,
  pgTable,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Anti-cheat rules applied by the game client.
 *
 * Each row is a single rule; the server serializes every row into the binary
 * anti-cheat rules format (see AntiCheatRulesService) and exposes it through
 * the `4030BF2F` key of the game configuration. Management-only data, so no
 * RLS policies are needed (mirrors `blocked_words`).
 */
export const antiCheatRulesTable = pgTable("anticheat_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Unique rule identifier used by the game (and the binary payload).
  ruleId: integer("rule_id").notNull().unique(),
  // Category of the rule (0x00 = EventRateLimit, 0x01 = MovementSpeedLimit).
  ruleType: integer("rule_type").notNull(),
  // Typed fields that parameterize the rule:
  // [{ fieldId, valueType (0x00 uint16 | 0x01 float32), value }]
  fields: jsonb("fields").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type AntiCheatRuleEntity = typeof antiCheatRulesTable.$inferSelect;
export type AntiCheatRuleInsertEntity = typeof antiCheatRulesTable.$inferInsert;
