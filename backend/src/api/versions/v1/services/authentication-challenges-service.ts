import { inject, injectable } from "@needle-di/core";
import { and, eq, lt } from "drizzle-orm";
import { authenticationChallengesTable } from "../../../../db/schema.ts";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { sql } from "drizzle-orm";

@injectable()
export class AuthenticationChallengesService {
  constructor(private databaseService = inject(DatabaseService)) {}

  public async save(
    transactionId: string,
    type: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    await this.databaseService
      .get()
      .insert(authenticationChallengesTable)
      .values({
        transactionId,
        type,
        data,
      });
  }

  public async consume<T>(
    transactionId: string,
    type: string,
  ): Promise<{ data: T; createdAt: Date } | null> {
    const rows = await this.databaseService
      .get()
      .delete(authenticationChallengesTable)
      .where(
        and(
          eq(authenticationChallengesTable.transactionId, transactionId),
          eq(authenticationChallengesTable.type, type),
        ),
      )
      .returning({
        data: authenticationChallengesTable.data,
        createdAt: authenticationChallengesTable.createdAt,
      });

    if (rows.length === 0) return null;

    return { data: rows[0].data as T, createdAt: rows[0].createdAt };
  }

  /** Removes challenges older than the one-hour lifetime used by the old cron. */
  public async cleanupExpired(): Promise<number> {
    const deleted = await this.databaseService
      .get()
      .delete(authenticationChallengesTable)
      .where(
        lt(
          authenticationChallengesTable.createdAt,
          sql`now() - interval '1 hour'`,
        ),
      )
      .returning({ id: authenticationChallengesTable.id });

    return deleted.length;
  }
}
