import { lt } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { DatabaseService } from "../src/core/services/database-service.ts";
import { authenticationChallengesTable } from "../src/db/schema.ts";

export function registerCleanupAuthenticationChallengesCron(
  databaseService: DatabaseService,
): void {
  Deno.cron("cleanup-authentication-challenges", "0 * * * *", async () => {
    const db = databaseService.get();

    const result = await db
      .delete(authenticationChallengesTable)
      .where(
        lt(
          authenticationChallengesTable.createdAt,
          sql`now() - interval '1 hour'`,
        ),
      );

    console.log(
      `[cron] Cleaned up ${result.rowCount} expired authentication challenges`,
    );
  });
}
