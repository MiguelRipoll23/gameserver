import { inject, injectable } from "@needle-di/core";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { eq, sql } from "drizzle-orm";
import { refreshTokensTable, usersTable } from "../../../../db/schema.ts";

export interface RefreshTokenData {
  userId: string;
  expiresAt: number;
  tokenVersion: number;
}

@injectable()
export class RefreshTokensService {
  constructor(private databaseService = inject(DatabaseService)) {}

  public async save(
    tokenHash: string,
    userId: string,
    expiresAt: Date,
    tokenVersion: number,
  ): Promise<void> {
    await this.databaseService
      .get()
      .insert(refreshTokensTable)
      .values({ tokenHash, userId, expiresAt, tokenVersion });
  }

  public async consume(tokenHash: string): Promise<RefreshTokenData | null> {
    const rows = await this.databaseService
      .get()
      .delete(refreshTokensTable)
      .where(eq(refreshTokensTable.tokenHash, tokenHash))
      .returning({
        userId: refreshTokensTable.userId,
        expiresAt: refreshTokensTable.expiresAt,
        tokenVersion: refreshTokensTable.tokenVersion,
      });

    if (rows.length === 0) return null;

    return {
      userId: rows[0].userId,
      expiresAt: rows[0].expiresAt.getTime(),
      tokenVersion: rows[0].tokenVersion,
    };
  }

  public async getVersion(userId: string): Promise<number> {
    return await this.databaseService.executeWithUserContext(userId, async (tx) => {
      const rows = await tx
        .select({ tokenVersion: usersTable.tokenVersion })
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1);

      return rows.length === 0 ? 0 : rows[0].tokenVersion;
    });
  }

  public async incrementVersion(userId: string): Promise<void> {
    await this.databaseService.executeWithUserContext(userId, async (tx) => {
      await tx
        .update(usersTable)
        .set({ tokenVersion: sql`${usersTable.tokenVersion} + 1` })
        .where(eq(usersTable.id, userId));
    });
  }
}
