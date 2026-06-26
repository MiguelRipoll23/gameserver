import { inject, injectable } from "@needle-di/core";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { ServerError } from "../models/server-error.ts";
import { userCredentialsTable } from "../../../../db/schema.ts";
import { and, eq, lt } from "drizzle-orm";
import type { UserCredentialEntity } from "../../../../db/tables/user-credentials-table.ts";

@injectable()
export class CredentialsService {
  constructor(private databaseService = inject(DatabaseService)) {}

  public async getByIdOrThrow(id: string): Promise<UserCredentialEntity> {
    try {
      const credentials =
        await this.databaseService.executeWithCredentialContext(id, (tx) => {
          return tx
            .select()
            .from(userCredentialsTable)
            .where(eq(userCredentialsTable.id, id))
            .limit(1);
        });

      if (credentials.length === 0) {
        throw new ServerError(
          "CREDENTIAL_NOT_FOUND",
          "Credential not found",
          400,
        );
      }

      return credentials[0];
    } catch (error) {
      if (error instanceof ServerError) throw error;
      console.error("Failed to query credential:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to retrieve credential",
        500,
      );
    }
  }

  public async updateCounter(
    id: string,
    userId: string,
    newCounter: number,
  ): Promise<void> {
    try {
      await this.databaseService.executeWithCredentialAndUserContext(
        id,
        userId,
        (tx) => {
          return tx
            .update(userCredentialsTable)
            .set({ counter: newCounter })
            .where(
              and(
                eq(userCredentialsTable.id, id),
                lt(userCredentialsTable.counter, newCounter),
              ),
            );
        },
      );
    } catch (error) {
      console.error("Failed to update credential counter:", error);
      throw new ServerError(
        "CREDENTIAL_COUNTER_UPDATE_FAILED",
        "Failed to update credential counter",
        500,
      );
    }
  }
}
