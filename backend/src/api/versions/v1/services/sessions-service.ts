import { inject, injectable } from "@needle-di/core";
import { Logger } from "../../../../core/utils/logger.ts";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { ServerError } from "../models/server-error.ts";
import { userSessionsTable, usersTable } from "../../../../db/schema.ts";
import {
  SESSION_LIFETIME_SECONDS,
} from "../constants/authentication-constants.ts";
import type { StringPaginationParams } from "../schemas/pagination-schemas.ts";
import type { GetUserSessionsResponse } from "../schemas/user-sessions-schemas.ts";
import { and, desc, eq, lt, sql } from "drizzle-orm";

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
                sql`${userSessionsTable.updatedAt} >= NOW() - (${
                  sql.raw(String(SESSION_LIFETIME_SECONDS))
                } * INTERVAL '1 second')`,
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
      Logger.error("Failed to query active user session:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to validate active session",
        500,
      );
    }
  }

  public async ensureHasNoActiveSession(userId: string): Promise<void> {
    try {
      const existingSessions = await this.databaseService
        .executeWithUserContext(
          userId,
          (tx) => {
            return tx
              .select({ userId: userSessionsTable.userId })
              .from(userSessionsTable)
              .where(
                and(
                  eq(userSessionsTable.userId, userId),
                  sql`${userSessionsTable.updatedAt} >= NOW() - (${
                    sql.raw(String(SESSION_LIFETIME_SECONDS))
                  } * INTERVAL '1 second')`,
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
      Logger.error("Failed to query user sessions:", error);
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
      Logger.error(
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
      Logger.log(`Deleted session for user ${userName}`);
    }
  }

  /**
   * Lists all user sessions with pagination (ordered by user ID).
   */
  public async list(
    params: Partial<StringPaginationParams> = {},
  ): Promise<GetUserSessionsResponse> {
    const { cursor, limit = 20 } = params;
    const db = this.databaseService.get();

    const conditions = cursor
      ? [lt(userSessionsTable.userId, cursor)]
      : undefined;

    const sessions = await db
      .select({
        userId: userSessionsTable.userId,
        userDisplayName: usersTable.displayName,
        token: userSessionsTable.token,
        publicIp: userSessionsTable.publicIp,
        country: userSessionsTable.country,
        createdAt: userSessionsTable.createdAt,
        updatedAt: userSessionsTable.updatedAt,
      })
      .from(userSessionsTable)
      .innerJoin(usersTable, eq(userSessionsTable.userId, usersTable.id))
      .where(conditions ? conditions[0] : undefined)
      .orderBy(desc(userSessionsTable.userId))
      .limit(limit + 1);

    const hasNextPage = sessions.length > limit;
    const results = sessions.slice(0, limit);

    return {
      results: results.map((session) => ({
        userId: session.userId,
        userDisplayName: session.userDisplayName,
        token: session.token,
        publicIp: session.publicIp,
        country: session.country,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
      })),
      nextCursor:
        hasNextPage && results.length > 0
          ? results[results.length - 1].userId
          : undefined,
      hasMore: hasNextPage,
    };
  }

  /**
   * Deletes a session by user ID and throws when it does not exist.
   */
  public async deleteById(userId: string): Promise<void> {
    const db = this.databaseService.get();
    const deletedSessions = await db
      .delete(userSessionsTable)
      .where(eq(userSessionsTable.userId, userId))
      .returning({ id: userSessionsTable.userId });

    if (deletedSessions.length === 0) {
      throw new ServerError(
        "SESSION_NOT_FOUND",
        `Session for user ${userId} does not exist`,
        404,
      );
    }

    Logger.log(`Deleted session for user ${userId}`);
  }
}
