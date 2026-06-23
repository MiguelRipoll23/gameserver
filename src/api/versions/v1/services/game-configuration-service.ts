import { inject, injectable } from "@needle-di/core";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { eq } from "drizzle-orm";
import { gameConfigurationTable } from "../../../../db/schema.ts";

@injectable()
export class GameConfigurationService {
  constructor(private databaseService = inject(DatabaseService)) {}

  public async get(key: string): Promise<Record<string, unknown> | null> {
    const rows = await this.databaseService
      .get()
      .select({ value: gameConfigurationTable.value })
      .from(gameConfigurationTable)
      .where(eq(gameConfigurationTable.key, key))
      .limit(1);

    if (rows.length === 0) return null;

    return rows[0].value as Record<string, unknown>;
  }

  public async save(key: string, value: Record<string, unknown>): Promise<void> {
    await this.databaseService
      .get()
      .insert(gameConfigurationTable)
      .values({ key, value })
      .onConflictDoUpdate({
        target: gameConfigurationTable.key,
        set: { value, updatedAt: new Date() },
      });
  }
}
