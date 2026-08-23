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
 * An anti-cheat rule: a unique identifier, a type category, and typed fields.
 *
 * Violations are always recorded as automatic reports; the server does not
 * take an automatic action (such as banning) from a client-submitted report.
 */
export interface AntiCheatRule {
  /** Unique rule identifier. */
  ruleId: number;
  /** Category of the rule (0x00 = EventRateLimit, 0x01 = MovementSpeedLimit). */
  ruleType: number;
  /** Typed fields that parameterize the rule. */
  fields: AntiCheatRuleField[];
}
