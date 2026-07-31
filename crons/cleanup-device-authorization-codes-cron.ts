import { lt } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { DatabaseService } from "../src/core/services/database-service.ts";
import { deviceAuthorizationCodesTable } from "../src/db/schema.ts";

export function registerCleanupDeviceAuthorizationCodesCron(
  databaseService: DatabaseService,
): void {
  Deno.cron("cleanup-device-authorization-codes", "0 * * * *", async () => {
    const db = databaseService.get();

    const result = await db
      .delete(deviceAuthorizationCodesTable)
      .where(
        lt(deviceAuthorizationCodesTable.expiresAt, sql`now()`),
      );

    console.log(
      `[cron] Cleaned up ${result.rowCount} expired device authorization codes`,
    );
  });
}
