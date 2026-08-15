import { inject, injectable } from "@needle-di/core";
import { and, asc, eq, gt, type SQL } from "drizzle-orm";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { antiCheatRulesTable } from "../../../../db/schema.ts";
import { BinaryWriter } from "../../../../core/utils/binary-writer-utils.ts";
import { Base64Utils } from "../../../../core/utils/base64-utils.ts";
import { ServerError } from "../models/server-error.ts";
import type {
  GetAntiCheatRulesQuery,
  GetAntiCheatRulesResponse,
  UpdateAntiCheatRuleRequest,
} from "../schemas/anti-cheat-rules-schemas.ts";
import type {
  AntiCheatRule,
  AntiCheatRuleAction,
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
 *
 * The `action` (report/ban) is server-side only and is deliberately excluded
 * from the binary payload — the client only detects and reports violations.
 */
@injectable()
export class AntiCheatRulesService {
  constructor(private databaseService = inject(DatabaseService)) {}

  /**
   * Lists rules ordered by ruleId with keyset pagination and an optional
   * ruleType filter.
   */
  public async list(
    params: Partial<GetAntiCheatRulesQuery> = {},
  ): Promise<GetAntiCheatRulesResponse> {
    const { cursor, limit = 20, ruleType } = params;
    const db = this.databaseService.get();

    const conditions: SQL[] = [];

    if (ruleType !== undefined) {
      conditions.push(eq(antiCheatRulesTable.ruleType, ruleType));
    }

    if (cursor !== undefined) {
      conditions.push(gt(antiCheatRulesTable.ruleId, cursor));
    }

    const rows = await db
      .select()
      .from(antiCheatRulesTable)
      .where(
        conditions.length === 0
          ? undefined
          : conditions.length === 1
            ? conditions[0]
            : and(...conditions),
      )
      .orderBy(asc(antiCheatRulesTable.ruleId))
      .limit(limit + 1);

    const hasNextPage = rows.length > limit;
    const results = rows.slice(0, limit).map((row) => ({
      ruleId: row.ruleId,
      ruleType: row.ruleType,
      action: row.action,
      fields: row.fields as unknown as AntiCheatRuleField[],
    }));

    return {
      results,
      nextCursor:
        hasNextPage && results.length > 0
          ? results[results.length - 1].ruleId
          : undefined,
      hasMore: hasNextPage,
    };
  }

  /**
   * Returns the full rule set (no pagination). Used to re-serialize the game
   * configuration after a single-rule mutation.
   */
  public async getAllRules(): Promise<AntiCheatRule[]> {
    const db = this.databaseService.get();
    const rows = await db
      .select()
      .from(antiCheatRulesTable)
      .orderBy(asc(antiCheatRulesTable.ruleId));

    return rows.map((row) => ({
      ruleId: row.ruleId,
      ruleType: row.ruleType,
      action: row.action,
      fields: row.fields as unknown as AntiCheatRuleField[],
    }));
  }

  /**
   * Returns the server-side action for a single rule, or `null` when the rule
   * does not exist.
   */
  public async getRuleAction(
    ruleId: number,
  ): Promise<AntiCheatRuleAction | null> {
    const db = this.databaseService.get();
    const rows = await db
      .select({ action: antiCheatRulesTable.action })
      .from(antiCheatRulesTable)
      .where(eq(antiCheatRulesTable.ruleId, ruleId))
      .limit(1);

    return rows[0]?.action ?? null;
  }

  /**
   * Creates a single anti-cheat rule.
   * @throws ServerError when a rule with the same ruleId already exists
   */
  public async createRule(rule: AntiCheatRule): Promise<void> {
    const db = this.databaseService.get();

    const existing = await db
      .select({ ruleId: antiCheatRulesTable.ruleId })
      .from(antiCheatRulesTable)
      .where(eq(antiCheatRulesTable.ruleId, rule.ruleId))
      .limit(1);

    if (existing.length > 0) {
      throw new ServerError(
        "RULE_ALREADY_EXISTS",
        `Anti-cheat rule with ruleId ${rule.ruleId} already exists`,
        409,
      );
    }

    await db.insert(antiCheatRulesTable).values({
      ruleId: rule.ruleId,
      ruleType: rule.ruleType,
      action: rule.action,
      fields: rule.fields,
      updatedAt: new Date(),
    });
  }

  /**
   * Replaces the content of an existing anti-cheat rule.
   * @throws ServerError when the rule does not exist
   */
  public async updateRule(
    ruleId: number,
    data: UpdateAntiCheatRuleRequest,
  ): Promise<void> {
    const db = this.databaseService.get();

    const updated = await db
      .update(antiCheatRulesTable)
      .set({
        ruleType: data.ruleType,
        action: data.action,
        fields: data.fields,
        updatedAt: new Date(),
      })
      .where(eq(antiCheatRulesTable.ruleId, ruleId))
      .returning({ ruleId: antiCheatRulesTable.ruleId });

    if (updated.length === 0) {
      throw new ServerError(
        "RULE_NOT_FOUND",
        `Anti-cheat rule with ruleId ${ruleId} does not exist`,
        404,
      );
    }
  }

  /**
   * Deletes an anti-cheat rule.
   * @throws ServerError when the rule does not exist
   */
  public async deleteRule(ruleId: number): Promise<void> {
    const db = this.databaseService.get();

    const deleted = await db
      .delete(antiCheatRulesTable)
      .where(eq(antiCheatRulesTable.ruleId, ruleId))
      .returning({ ruleId: antiCheatRulesTable.ruleId });

    if (deleted.length === 0) {
      throw new ServerError(
        "RULE_NOT_FOUND",
        `Anti-cheat rule with ruleId ${ruleId} does not exist`,
        404,
      );
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
