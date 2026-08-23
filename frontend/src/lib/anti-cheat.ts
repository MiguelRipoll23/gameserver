/**
 * Shared anti-cheat definitions types and helpers.
 *
 * The definitions document mirrors the game server's
 * GET/PUT /api/v1/anti-cheat-definitions endpoints: numeric identifiers
 * (as JSON string keys) mapped to human-readable labels, descriptions and
 * hints used to render anti-cheat rules in the management console.
 */

export interface RuleTypeDefinition {
  label: string
  description: string
}

export interface RuleFieldDefinition {
  label: string
  hint: string
}

export interface AntiCheatDefinitions {
  ruleTypes: Record<string, RuleTypeDefinition>
  ruleFields: Record<string, Record<string, RuleFieldDefinition>>
  eventNames: Record<string, string>
  entityNames: Record<string, string>
  valueTypes: Record<string, string>
}

/** Converts a JSON string-keyed map into a numeric-keyed map. */
export function toNumberMap<T>(record: Record<string, T> | undefined): Record<number, T> {
  const out: Record<number, T> = {}
  if (!record) return out
  for (const [key, value] of Object.entries(record)) {
    const n = Number(key)
    if (Number.isInteger(n)) out[n] = value
  }
  return out
}

/** Converts a nested JSON string-keyed map into a nested numeric-keyed map. */
export function toNestedNumberMap<T>(
  record: Record<string, Record<string, T>> | undefined,
): Record<number, Record<number, T>> {
  const out: Record<number, Record<number, T>> = {}
  if (!record) return out
  for (const [key, value] of Object.entries(record)) {
    const n = Number(key)
    if (Number.isInteger(n)) out[n] = toNumberMap(value)
  }
  return out
}
