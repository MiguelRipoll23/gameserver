import { lt } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { DatabaseService } from "../src/core/services/database-service.ts";
import { refreshTokensTable } from "../src/db/schema.ts";

export function registerCleanupRefreshTokensCron(
  databaseService: DatabaseService,
): void {
  Deno.cron("cleanup-refresh-tokens", "0 * * * *", async () => {
    const db = databaseService.get();

    const result = await db
      .delete(refreshTokensTable)
      .where(
        lt(refreshTokensTable.expiresAt, sql`now()`),
      );

    console.log(
      `[cron] Cleaned up ${result.rowCount} expired refresh tokens`,
    );
  });
}
