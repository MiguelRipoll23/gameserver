import { inject, injectable } from "@needle-di/core";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { ServerError } from "../models/server-error.ts";
import { userSessionsTable } from "../../../../db/schema.ts";
import {
  SESSION_LIFETIME_SECONDS,
} from "../constants/authentication-constants.ts";
import { and, count, eq, sql } from "drizzle-orm";

@injectable()
export class SessionsService {
  constructor(private databaseService = inject(DatabaseService)) {}

  public async ensureHasActiveSession(userId: string): Promise<void> {
    try {
      const activeSessions = await this.databaseService.executeWithUserContext(
        userId,
        (tx) => {
          return tx
            .select({ userId: userSessionsTable.userId })
            .from(userSessionsTable)
            .where(
              and(
                eq(userSessionsTable.userId, userId),
                sql`${userSessionsTable.updatedAt} >= NOW() - (${sql.raw(String(SESSION_LIFETIME_SECONDS))} * INTERVAL '1 second')`,
              ),
            )
            .limit(1);
        },
      );

      if (activeSessions.length === 0) {
        throw new ServerError("SESSION_NOT_FOUND", "Session not found", 401);
      }
    } catch (error) {
      if (error instanceof ServerError) throw error;
      console.error("Failed to query active user session:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to validate active session",
        500,
      );
    }
  }

  public async ensureHasNoActiveSession(userId: string): Promise<void> {
    try {
      const existingSessions =
        await this.databaseService.executeWithUserContext(
          userId,
          (tx) => {
            return tx
              .select({ userId: userSessionsTable.userId })
              .from(userSessionsTable)
              .where(
                and(
                  eq(userSessionsTable.userId, userId),
                  sql`${userSessionsTable.updatedAt} >= NOW() - (${sql.raw(String(SESSION_LIFETIME_SECONDS))} * INTERVAL '1 second')`,
                ),
              )
              .limit(1);
          },
        );

      if (existingSessions.length > 0) {
        throw new ServerError(
          "USER_ALREADY_SIGNED_IN",
          "Please disconnect from other devices before signing in.",
          409,
        );
      }
    } catch (error) {
      if (error instanceof ServerError) throw error;
      console.error("Failed to query user sessions:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to check for existing sessions",
        500,
      );
    }
  }

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

  public async getTokenByUserId(userId: string): Promise<string | null> {
    const db = this.databaseService.get();
    const session = await db
      .select({ token: userSessionsTable.token })
      .from(userSessionsTable)
      .where(eq(userSessionsTable.userId, userId))
      .limit(1);

    return session.length > 0 ? session[0].token : null;
  }

  /**
   * Check if a session exists for the given user ID
   * More efficient than getTokenByUserId when only checking existence
   */
  public async existsByUserId(userId: string): Promise<boolean> {
    const db = this.databaseService.get();
    const result = await db
      .select({ exists: sql<number>`1` })
      .from(userSessionsTable)
      .where(eq(userSessionsTable.userId, userId))
      .limit(1);

    return result.length > 0;
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
