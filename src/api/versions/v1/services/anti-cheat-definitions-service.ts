import { asc } from "drizzle-orm";
import { inject, injectable } from "@needle-di/core";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { antiCheatDefinitionsTable } from "../../../../db/schema.ts";
import type { AntiCheatDefinitionInsertEntity } from "../../../../db/tables/anti-cheat-definitions-table.ts";
import type {
  AntiCheatDefinitionsResponse,
  UpdateAntiCheatDefinitionsRequest,
} from "../schemas/anti-cheat-definitions-schemas.ts";

type DefinitionKind =
  | "ruleType"
  | "ruleField"
  | "eventName"
  | "entityName"
  | "valueType";

/**
 * Reads and writes the anti-cheat rule definitions persisted in the database.
 *
 * The definitions are one row per entry (see `anticheat_definitions`): each
 * row carries a `kind` discriminator, a numeric `key`, and an optional
 * `parentKey` for hierarchical entries (rule fields). This service flattens
 * the nested document the management console edits into rows on save, and
 * reconstructs the document on read.
 */
@injectable()
export class AntiCheatDefinitionsService {
  constructor(private databaseService = inject(DatabaseService)) {}

  public async get(): Promise<AntiCheatDefinitionsResponse> {
    const db = this.databaseService.get();
    const rows = await db
      .select()
      .from(antiCheatDefinitionsTable)
      .orderBy(asc(antiCheatDefinitionsTable.id));

    const definitions: AntiCheatDefinitionsResponse = {
      ruleTypes: {},
      ruleFields: {},
      eventNames: {},
      entityNames: {},
      valueTypes: {},
    };

    for (const row of rows) {
      switch (row.kind as DefinitionKind) {
        case "ruleType":
          definitions.ruleTypes[row.key] = {
            label: row.label,
            description: row.description ?? "",
          };
          break;
        case "ruleField": {
          const fields = (definitions.ruleFields[row.parentKey] ??= {});
          fields[row.key] = { label: row.label, hint: row.hint ?? "" };
          break;
        }
        case "eventName":
          definitions.eventNames[row.key] = row.label;
          break;
        case "entityName":
          definitions.entityNames[row.key] = row.label;
          break;
        case "valueType":
          definitions.valueTypes[row.key] = row.label;
          break;
      }
    }

    return definitions;
  }

  /**
   * Replaces the full set of definitions with the provided document, in a
   * single transaction so the console never observes a partially-written set.
   */
  public async set(data: UpdateAntiCheatDefinitionsRequest): Promise<void> {
    const db = this.databaseService.get();
    const rows = this.flatten(data);

    await db.transaction(async (tx) => {
      await tx.delete(antiCheatDefinitionsTable);
      if (rows.length > 0) {
        await tx.insert(antiCheatDefinitionsTable).values(rows);
      }
    });
  }

  /** Flattens the nested definitions document into table rows. */
  private flatten(
    data: UpdateAntiCheatDefinitionsRequest,
  ): AntiCheatDefinitionInsertEntity[] {
    const rows: AntiCheatDefinitionInsertEntity[] = [];

    for (const [key, def] of Object.entries(data.ruleTypes)) {
      rows.push({
        kind: "ruleType",
        key,
        parentKey: "",
        label: def.label,
        description: def.description,
      });
    }

    for (const [parentKey, fields] of Object.entries(data.ruleFields)) {
      for (const [key, def] of Object.entries(fields)) {
        rows.push({
          kind: "ruleField",
          key,
          parentKey,
          label: def.label,
          hint: def.hint,
        });
      }
    }

    for (const [key, label] of Object.entries(data.eventNames)) {
      rows.push({ kind: "eventName", key, parentKey: "", label });
    }

    for (const [key, label] of Object.entries(data.entityNames)) {
      rows.push({ kind: "entityName", key, parentKey: "", label });
    }

    for (const [key, label] of Object.entries(data.valueTypes)) {
      rows.push({ kind: "valueType", key, parentKey: "", label });
    }

    return rows;
  }
}
