import { inject, injectable } from "@needle-di/core";
import { Logger } from "../../../../core/utils/logger.ts";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { ServerError } from "../models/server-error.ts";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  AutomaticReportUserRequest,
  BanDuration,
  BanUserRequest,
  GetUserBansRequest,
  GetUserBansResponse,
  GetUserReportsAutomaticRequest,
  GetUserReportsAutomaticResponse,
  GetUserReportsManualRequest,
  GetUserReportsManualResponse,
  ManualReportUserRequest,
} from "../schemas/user-moderation-schemas.ts";
import {
  userBansTable,
  userReportsAutomaticTable,
  userReportsManualTable,
  usersTable,
} from "../../../../db/schema.ts";
import { and, desc, eq, gt } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { env } from "cloudflare:workers";
import { WEBSOCKET_DURABLE_OBJECT_NAME } from "../constants/durable-object-constants.ts";

@injectable()
export class UserModerationService {
  constructor(
    private databaseService = inject(DatabaseService),
  ) {}

  public async isBanned(userId: string): Promise<boolean> {
    const rows = await this.databaseService
      .get()
      .select({ expiresAt: userBansTable.expiresAt })
      .from(userBansTable)
      .where(eq(userBansTable.userId, userId))
      .orderBy(desc(userBansTable.createdAt))
      .limit(1);

    if (rows.length === 0) return false;

    const latestBan = rows[0];
    return !latestBan.expiresAt || latestBan.expiresAt > new Date();
  }

  public async getUserByDisplayName(
    displayName: string,
  ): Promise<{ id: string; displayName: string } | null> {
    const users = await this.databaseService
      .get()
      .select({ id: usersTable.id, displayName: usersTable.displayName })
      .from(usersTable)
      .where(eq(usersTable.displayName, displayName))
      .limit(1);

    return users[0] ?? null;
  }

  public async banUser(
    body: BanUserRequest,
    issuedByUserId?: string,
  ): Promise<void> {
    const { userId, reason, duration } = body;
    const db = this.databaseService.get();

    // Calculate expiration date
    const expiresAt = this.calculateExpirationDate(duration);

    // Create ban record atomically with user existence check
    try {
      await db.transaction(async (tx) => {
        // Check if user exists and lock the row to prevent race conditions
        await this.checkUserExists(tx, userId, true);

        // Check for existing active ban
        const existingBans = await tx
          .select({ id: userBansTable.id, expiresAt: userBansTable.expiresAt })
          .from(userBansTable)
          .where(eq(userBansTable.userId, userId))
          .orderBy(desc(userBansTable.createdAt))
          .limit(1);

        if (existingBans.length > 0) {
          const existingBan = existingBans[0];
          const now = new Date();

          // If ban has not expired (either permanent or still active), throw error
          if (!existingBan.expiresAt || existingBan.expiresAt > now) {
            throw new ServerError(
              "USER_ALREADY_BANNED",
              "User is already banned",
              409,
            );
          }
        }

        // Create ban record
        await tx
          .insert(userBansTable)
          .values({
            userId,
            issuedBy: issuedByUserId ?? null,
            reason,
            expiresAt,
          });
      });
    } catch (error) {
      if (error instanceof ServerError) {
        throw error;
      }
      Logger.error("Database error while creating ban record:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to create ban record",
        500,
      );
    }

    Logger.log(
      `User ${userId} has been banned for: ${reason}${
        duration ? ` (expires: ${expiresAt})` : " (permanent)"
      }`,
    );
    await env.WEBSOCKET_DURABLE_OBJECT.getByName(WEBSOCKET_DURABLE_OBJECT_NAME).kickPlayer(userId);
  }

  public async unbanUser(userId: string): Promise<void> {
    const db = this.databaseService.get();

    // Get the latest ban
    const latestBan = await db
      .select({ id: userBansTable.id, expiresAt: userBansTable.expiresAt })
      .from(userBansTable)
      .where(eq(userBansTable.userId, userId))
      .orderBy(desc(userBansTable.createdAt))
      .limit(1);

    if (latestBan.length === 0) {
      throw new ServerError(
        "USER_NOT_BANNED",
        `User with id ${userId} is not banned`,
        404,
      );
    }

    // Check if the latest ban is actually active
    const now = new Date();
    const ban = latestBan[0];
    if (ban.expiresAt && ban.expiresAt <= now) {
      throw new ServerError(
        "USER_NOT_BANNED",
        `User with id ${userId} is not banned`,
        404,
      );
    }

    // Delete the latest ban
    await db
      .delete(userBansTable)
      .where(eq(userBansTable.id, ban.id));

    Logger.log(`User ${userId} has been unbanned`);
  }

  /**
   * Records a manual report filed by one human player against another.
   */
  public async reportUserManual(
    reporterUserId: string,
    body: ManualReportUserRequest,
  ): Promise<void> {
    const { userId, reason } = body;

    if (reporterUserId === userId) {
      throw new ServerError(
        "INVALID_REPORT",
        "Cannot report yourself",
        400,
      );
    }

    const db = this.databaseService.get();

    try {
      await db.transaction(async (tx) => {
        await this.checkUserExists(tx, userId);

        await tx.insert(userReportsManualTable).values({
          userId,
          issuedBy: reporterUserId,
          reason,
        });
      });
    } catch (error) {
      if (error instanceof ServerError) {
        throw error;
      }
      Logger.error("Database error while creating report:", error);
      throw new ServerError("DATABASE_ERROR", "Failed to create report", 500);
    }
  }

  /**
   * Records an automatic anti-cheat report.
   *
   * The report is always recorded and never triggers an automatic action:
   * client-submitted violation reports are unauthenticated evidence, so the
   * server records them for review instead of banning players from them.
   */
  public async reportAutomaticViolation(
    body: AutomaticReportUserRequest,
    issuedByUserId?: string,
  ): Promise<void> {
    const { userId, ruleId } = body;
    const db = this.databaseService.get();

    try {
      await db.transaction(async (tx) => {
        await this.checkUserExists(tx, userId);

        await tx.insert(userReportsAutomaticTable).values({
          userId,
          issuedBy: issuedByUserId ?? null,
          ruleId,
        });
      });
    } catch (error) {
      if (error instanceof ServerError) {
        throw error;
      }
      Logger.error("Database error while creating automatic report:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to create automatic report",
        500,
      );
    }
  }

  public async getUserManualReports(
    params: GetUserReportsManualRequest,
  ): Promise<GetUserReportsManualResponse> {
    const { userId, cursor, limit = 20 } = params;
    const db = this.databaseService.get();

    try {
      return await db.transaction(async (tx) => {
        const conditions = [];

        if (userId !== undefined) {
          await this.checkUserExists(tx, userId);
          conditions.push(eq(userReportsManualTable.userId, userId));
        }

        if (cursor) {
          conditions.push(gt(userReportsManualTable.id, cursor));
        }

        const reporterUser = alias(usersTable, "reporter_user");
        const reportedUser = alias(usersTable, "reported_user");
        const reports = await tx
          .select({
            id: userReportsManualTable.id,
            userId: userReportsManualTable.userId,
            userDisplayName: reportedUser.displayName,
            issuedByUserId: userReportsManualTable.issuedBy,
            issuedByUserDisplayName: reporterUser.displayName,
            reason: userReportsManualTable.reason,
            createdAt: userReportsManualTable.createdAt,
            updatedAt: userReportsManualTable.updatedAt,
          })
          .from(userReportsManualTable)
          .innerJoin(
            reporterUser,
            eq(userReportsManualTable.issuedBy, reporterUser.id),
          )
          .innerJoin(
            reportedUser,
            eq(userReportsManualTable.userId, reportedUser.id),
          )
          .where(
            conditions.length === 0
              ? undefined
              : conditions.length === 1
                ? conditions[0]
                : and(...conditions),
          )
          .orderBy(userReportsManualTable.id)
          .limit(limit + 1);

        const hasNextPage = reports.length > limit;
        const results = reports.slice(0, limit);

        return {
          results: results.map((report) => ({
            userId: report.userId,
            userDisplayName: report.userDisplayName,
            issuedByUserId: report.issuedByUserId,
            issuedByUserDisplayName: report.issuedByUserDisplayName,
            reason: report.reason,
            createdAt: report.createdAt.toISOString(),
            updatedAt: report.updatedAt?.toISOString() || null,
          })),
          nextCursor: hasNextPage ? results[results.length - 1].id : undefined,
          hasMore: hasNextPage,
        };
      });
    } catch (error) {
      if (error instanceof ServerError) {
        throw error;
      }
      Logger.error("Database error while fetching user reports:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to fetch user reports",
        500,
      );
    }
  }

  public async getUserAutomaticReports(
    params: GetUserReportsAutomaticRequest,
  ): Promise<GetUserReportsAutomaticResponse> {
    const { userId, cursor, limit = 20 } = params;
    const db = this.databaseService.get();

    try {
      return await db.transaction(async (tx) => {
        const conditions = [];

        if (userId !== undefined) {
          await this.checkUserExists(tx, userId);
          conditions.push(eq(userReportsAutomaticTable.userId, userId));
        }

        if (cursor) {
          conditions.push(gt(userReportsAutomaticTable.id, cursor));
        }

        const issuerUser = alias(usersTable, "issuer_user");
        const reportedUser = alias(usersTable, "reported_user");
        const reports = await tx
          .select({
            id: userReportsAutomaticTable.id,
            userId: userReportsAutomaticTable.userId,
            userDisplayName: reportedUser.displayName,
            issuedByUserId: userReportsAutomaticTable.issuedBy,
            issuedByUserDisplayName: issuerUser.displayName,
            ruleId: userReportsAutomaticTable.ruleId,
            createdAt: userReportsAutomaticTable.createdAt,
            updatedAt: userReportsAutomaticTable.updatedAt,
          })
          .from(userReportsAutomaticTable)
          .innerJoin(
            reportedUser,
            eq(userReportsAutomaticTable.userId, reportedUser.id),
          )
          .leftJoin(
            issuerUser,
            eq(userReportsAutomaticTable.issuedBy, issuerUser.id),
          )
          .where(
            conditions.length === 0
              ? undefined
              : conditions.length === 1
                ? conditions[0]
                : and(...conditions),
          )
          .orderBy(userReportsAutomaticTable.id)
          .limit(limit + 1);

        const hasNextPage = reports.length > limit;
        const results = reports.slice(0, limit);

        return {
          results: results.map((report) => ({
            userId: report.userId,
            userDisplayName: report.userDisplayName,
            issuedByUserId: report.issuedByUserId ?? null,
            issuedByUserDisplayName: report.issuedByUserDisplayName ?? null,
            ruleId: report.ruleId,
            createdAt: report.createdAt.toISOString(),
            updatedAt: report.updatedAt?.toISOString() || null,
          })),
          nextCursor: hasNextPage ? results[results.length - 1].id : undefined,
          hasMore: hasNextPage,
        };
      });
    } catch (error) {
      if (error instanceof ServerError) {
        throw error;
      }
      Logger.error("Database error while fetching automatic reports:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to fetch automatic reports",
        500,
      );
    }
  }

  public async getUserBans(
    params: GetUserBansRequest,
  ): Promise<GetUserBansResponse> {
    const { userId, cursor, limit = 20 } = params;
    const db = this.databaseService.get();

    // Check if user exists and fetch bans in transaction
    try {
      return await db.transaction(async (tx) => {
        // Build query conditions. When a user ID is provided, verify the user
        // exists and filter bans by that user; otherwise list all bans.
        const conditions = [];

        if (userId !== undefined) {
          await this.checkUserExists(tx, userId);
          conditions.push(eq(userBansTable.userId, userId));
        }

        if (cursor) {
          conditions.push(gt(userBansTable.id, cursor));
        }

        // Fetch one extra item to determine if there are more results
        const bannedUser = alias(usersTable, "banned_user");
        const issuerUser = alias(usersTable, "issuer_user");
        const bans = await tx
          .select({
            id: userBansTable.id,
            userId: userBansTable.userId,
            userDisplayName: bannedUser.displayName,
            issuedByUserId: userBansTable.issuedBy,
            issuedByUserDisplayName: issuerUser.displayName,
            reason: userBansTable.reason,
            createdAt: userBansTable.createdAt,
            updatedAt: userBansTable.updatedAt,
            expiresAt: userBansTable.expiresAt,
          })
          .from(userBansTable)
          .innerJoin(bannedUser, eq(userBansTable.userId, bannedUser.id))
          .leftJoin(issuerUser, eq(userBansTable.issuedBy, issuerUser.id))
          .where(
            conditions.length === 0
              ? undefined
              : conditions.length === 1
                ? conditions[0]
                : and(...conditions),
          )
          .orderBy(userBansTable.id)
          .limit(limit + 1);

        // Remove the extra item and use it to determine if there are more results
        const hasNextPage = bans.length > limit;
        const results = bans.slice(0, limit);

        return {
          results: results.map((ban) => ({
            userId: ban.userId,
            userDisplayName: ban.userDisplayName,
            issuedByUserId: ban.issuedByUserId ?? null,
            issuedByUserDisplayName: ban.issuedByUserDisplayName ?? null,
            reason: ban.reason,
            createdAt: ban.createdAt.toISOString(),
            updatedAt: ban.updatedAt?.toISOString() || null,
            expiresAt: ban.expiresAt?.toISOString() || null,
          })),
          nextCursor: hasNextPage ? results[results.length - 1].id : undefined,
          hasMore: hasNextPage,
        };
      });
    } catch (error) {
      if (error instanceof ServerError) {
        throw error;
      }
      Logger.error("Database error while fetching user bans:", error);
      throw new ServerError("DATABASE_ERROR", "Failed to fetch user bans", 500);
    }
  }

  public async throwIfBanned(
    tx: NodePgDatabase,
    userId: string,
  ): Promise<void> {
    const userBans = await tx
      .select({ expiresAt: userBansTable.expiresAt })
      .from(userBansTable)
      .where(eq(userBansTable.userId, userId))
      .orderBy(desc(userBansTable.createdAt))
      .limit(1);

    if (userBans.length === 0) return;

    const latestBan = userBans[0];
    const now = new Date();

    if (!latestBan.expiresAt) {
      throw new ServerError(
        "USER_BANNED_PERMANENTLY",
        "Your account has been permanently banned",
        403,
      );
    }

    if (latestBan.expiresAt > now) {
      const formattedDate = latestBan.expiresAt.toLocaleString("en-US", {
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        dateStyle: "medium",
        timeStyle: "long",
      });

      throw new ServerError(
        "USER_BANNED_TEMPORARILY",
        `Your account is temporarily banned until ${formattedDate}.`,
        403,
      );
    }
  }

  private async checkUserExists(
    tx: NodePgDatabase,
    userId: string,
    lock: boolean = false,
  ): Promise<void> {
    try {
      const baseQuery = tx
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1);

      const users = await (lock ? baseQuery.for("update") : baseQuery);

      if (users.length === 0) {
        throw new ServerError("USER_NOT_FOUND", "User not found", 404);
      }
    } catch (error) {
      if (error instanceof ServerError) {
        throw error;
      }

      Logger.error("Database error while checking user existence:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to verify user existence",
        500,
      );
    }
  }

  private calculateExpirationDate(duration?: BanDuration): Date | null {
    if (!duration) {
      return null; // Permanent ban
    }

    const now = new Date();
    const { value, unit } = duration;

    // Validate value is a positive integer
    if (!Number.isInteger(value) || value <= 0) {
      throw new ServerError(
        "INVALID_DURATION_VALUE",
        "Duration value must be a positive integer",
        400,
      );
    }

    switch (unit) {
      case "minutes":
        return new Date(now.getTime() + value * 60 * 1000);
      case "hours":
        return new Date(now.getTime() + value * 60 * 60 * 1000);
      case "days":
        return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
      case "weeks":
        return new Date(now.getTime() + value * 7 * 24 * 60 * 60 * 1000);
      case "months": {
        const result = new Date(now);
        result.setMonth(result.getMonth() + value);
        return result;
      }
      case "years": {
        const result = new Date(now);
        result.setFullYear(result.getFullYear() + value);
        return result;
      }
      default:
        throw new ServerError(
          "INVALID_DURATION_UNIT",
          "Invalid duration unit",
          400,
        );
    }
  }
}
