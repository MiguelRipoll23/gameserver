/**
 * A typed field within an anti-cheat rule, mirroring the game's binary format.
 */
export interface AntiCheatRuleField {
  /** Parameter identifier (meaning depends on rule type). */
  fieldId: number;
  /** 0x00 = uint16, 0x01 = float32 */
  valueType: number;
  /** The parsed numeric value. */
  value: number;
}

/**
 * What the server does when a game client reports a violation of this rule.
 *   - `report`: record the automatic report only.
 *   - `ban`:    record the report and temporarily ban the player (1 day).
 */
export type AntiCheatRuleAction = "report" | "ban";

/**
 * An anti-cheat rule: a unique identifier, a type category, and typed fields.
 */
export interface AntiCheatRule {
  /** Unique rule identifier. */
  ruleId: number;
  /** Category of the rule (0x00 = EventRateLimit, 0x01 = MovementSpeedLimit). */
  ruleType: number;
  /** Server-side action taken on violation (report or ban). */
  action: AntiCheatRuleAction;
  /** Typed fields that parameterize the rule. */
  fields: AntiCheatRuleField[];
}
