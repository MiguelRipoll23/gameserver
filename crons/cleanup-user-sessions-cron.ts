import { lt } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { DatabaseService } from "../src/core/services/database-service.ts";
import { userSessionsTable } from "../src/db/schema.ts";

export function registerCleanupUserSessionsCron(
  databaseService: DatabaseService,
): void {
  Deno.cron("cleanup-user-sessions", "0 * * * *", async () => {
    const db = databaseService.get();

    const result = await db
      .delete(userSessionsTable)
      .where(
        lt(
          userSessionsTable.updatedAt,
          sql`now() - interval '30 days'`,
        ),
      );

    console.log(
      `[cron] Cleaned up ${result.rowCount} stale user sessions`,
    );
  });
}
