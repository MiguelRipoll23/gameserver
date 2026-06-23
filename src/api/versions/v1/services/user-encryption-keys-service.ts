import { inject, injectable } from "@needle-di/core";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { eq } from "drizzle-orm";
import { userEncryptionKeysTable } from "../../../../db/schema.ts";

@injectable()
export class UserEncryptionKeysService {
  constructor(private databaseService = inject(DatabaseService)) {}

  public async get(userId: string): Promise<string | null> {
    const rows = await this.databaseService.executeWithUserContext(
      userId,
      async (tx) => {
        return await tx
          .select({ key: userEncryptionKeysTable.key })
          .from(userEncryptionKeysTable)
          .where(eq(userEncryptionKeysTable.userId, userId))
          .limit(1);
      },
    );

    if (rows.length === 0) return null;

    return rows[0].key;
  }

  public async save(userId: string, key: string): Promise<void> {
    await this.databaseService.executeWithUserContext(userId, async (tx) => {
      await tx
        .insert(userEncryptionKeysTable)
        .values({ userId, key })
        .onConflictDoUpdate({
          target: userEncryptionKeysTable.userId,
          set: { key },
        });
    });
  }

  public async delete(userId: string): Promise<void> {
    await this.databaseService.executeWithUserContext(userId, async (tx) => {
      await tx
        .delete(userEncryptionKeysTable)
        .where(eq(userEncryptionKeysTable.userId, userId));
    });
  }
}
