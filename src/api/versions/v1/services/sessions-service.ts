import { inject, injectable } from "@needle-di/core";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { userSessionsTable } from "../../../../db/tables/user-sessions-table.ts";
import { count, eq } from "drizzle-orm";

@injectable()
export class SessionsService {
  constructor(private databaseService = inject(DatabaseService)) {}

  public async create(
    userId: string,
    userName: string,
    userToken: string,
    userPublicIp: string,
  ) {
    const db = this.databaseService.get();

    try {
      await db
        .insert(userSessionsTable)
        .values({
          userId: userId,
          token: userToken,
          publicIp: userPublicIp,
        })
        .onConflictDoUpdate({
          target: userSessionsTable.userId,
          set: {
            token: userToken,
            publicIp: userPublicIp,
            updatedAt: new Date(),
          },
        });
    } catch (error) {
      console.error(
        `Failed to create/update session for user ${userName}:`,
        error,
      );

      throw error;
    }
  }

  public async deleteByUserId(userId: string, userName: string): Promise<void> {
    const db = this.databaseService.get();
    const deletedSessions = await db
      .delete(userSessionsTable)
      .where(eq(userSessionsTable.userId, userId))
      .returning({ id: userSessionsTable.userId });

    if (deletedSessions.length > 0) {
      console.log(`Deleted session for user ${userName}`);
    }
  }

  public async getTotal(): Promise<number> {
    const db = this.databaseService.get();
    const result = await db.select({ count: count() }).from(userSessionsTable);
    return result[0]?.count ?? 0;
  }
}
