import { inject, injectable } from "@needle-di/core";
import { asc } from "drizzle-orm";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { antiCheatRulesTable } from "../../../../db/schema.ts";
import { BinaryWriter } from "../../../../core/utils/binary-writer-utils.ts";
import { Base64Utils } from "../../../../core/utils/base64-utils.ts";
import { ServerError } from "../models/server-error.ts";
import type {
  AntiCheatRule,
  AntiCheatRuleField,
} from "../types/anti-cheat-rule-type.ts";

const FIELD_VALUE_UINT16 = 0x00;
const FIELD_VALUE_FLOAT32 = 0x01;

/**
 * Persists and serializes the game's anti-cheat rules.
 *
 * Rules are stored as one row per rule. The game client expects them as a
 * binary blob (see the hood-ball client `serializeAntiCheatRules`), base64url
 * encoded under the `4030BF2F` game configuration key.
 *
 * Binary format (big-endian):
 *   uint16  ruleCount
 *   per rule: uint16 ruleId, uint8 ruleType, uint8 fieldCount
 *   per field: uint8 fieldId, uint8 valueType, then
 *     uint16 (valueType 0x00) or float32 (valueType 0x01)
 */
@injectable()
export class AntiCheatRulesService {
  constructor(private databaseService = inject(DatabaseService)) {}

  public async getRules(): Promise<AntiCheatRule[]> {
    const db = this.databaseService.get();
    const rows = await db
      .select()
      .from(antiCheatRulesTable)
      .orderBy(asc(antiCheatRulesTable.ruleId));

    return rows.map((row) => ({
      ruleId: row.ruleId,
      ruleType: row.ruleType,
      fields: row.fields as unknown as AntiCheatRuleField[],
    }));
  }

  /**
   * Replaces the entire rule set with the given rules.
   */
  public async replaceRules(rules: readonly AntiCheatRule[]): Promise<void> {
    this.throwIfDuplicateRuleIds(rules);

    const db = this.databaseService.get();

    await db.transaction(async (tx) => {
      await tx.delete(antiCheatRulesTable);

      if (rules.length === 0) {
        return;
      }

      await tx.insert(antiCheatRulesTable).values(
        rules.map((rule) => ({
          ruleId: rule.ruleId,
          ruleType: rule.ruleType,
          fields: rule.fields,
          updatedAt: new Date(),
        })),
      );
    });
  }

  private throwIfDuplicateRuleIds(rules: readonly AntiCheatRule[]): void {
    const seen = new Set<number>();

    for (const rule of rules) {
      if (seen.has(rule.ruleId)) {
        throw new ServerError(
          "DUPLICATE_RULE_ID",
          `Duplicate ruleId ${rule.ruleId}`,
          400,
        );
      }
      seen.add(rule.ruleId);
    }
  }

  /**
   * Serializes rules into the game's binary anti-cheat format, base64url
   * encoded (matches what the hood-ball client decodes with
   * `base64UrlToArrayBuffer`).
   */
  public serializeRulesToBase64Url(
    rules: readonly AntiCheatRule[],
  ): string {
    const writer = BinaryWriter.build();
    writer.unsignedInt16(rules.length);

    for (const rule of rules) {
      writer.unsignedInt16(rule.ruleId);
      writer.unsignedInt8(rule.ruleType);
      writer.unsignedInt8(rule.fields.length);

      for (const field of rule.fields) {
        writer.unsignedInt8(field.fieldId);
        writer.unsignedInt8(field.valueType);

        if (field.valueType === FIELD_VALUE_UINT16) {
          writer.unsignedInt16(field.value);
        } else {
          writer.float32(field.value);
        }
      }
    }

    return Base64Utils.arrayBufferToBase64Url(writer.toArrayBuffer());
  }
}
