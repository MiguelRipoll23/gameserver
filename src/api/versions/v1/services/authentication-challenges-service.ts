import { inject, injectable } from "@needle-di/core";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { and, eq } from "drizzle-orm";
import { authenticationChallengesTable } from "../../../../db/schema.ts";

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
        data: data as Record<string, unknown>,
      });
  }

  public async consume<T>(
    transactionId: string,
    type: string,
  ): Promise<T | null> {
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
      });

    if (rows.length === 0) return null;

    return rows[0].data as T;
  }
}
