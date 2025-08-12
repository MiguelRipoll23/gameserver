import { inject, injectable } from "@needle-di/core";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { ServerError } from "../models/server-error.ts";
import {
  BanUserRequest,
  ReportUserRequest,
  BanDuration,
  GetUserBansRequest,
  GetUserBansResponse,
  GetUserReportsRequest,
  GetUserReportsResponse,
} from "../schemas/user-moderation-schemas.ts";
import {
  usersTable,
  userReportsTable,
  userBansTable,
} from "../../../../db/schema.ts";
import { eq, gt, and } from "drizzle-orm";
import { KICK_USER_EVENT } from "../constants/event-constants.ts";

@injectable()
export class UserModerationService {
  constructor(private databaseService = inject(DatabaseService)) {}

  public async banUser(body: BanUserRequest): Promise<void> {
    const { userId, reason, duration } = body;
    const db = this.databaseService.get();

    // Check if user exists
    await this.checkUserExists(userId);

    // Calculate expiration date
    const expiresAt = this.calculateExpirationDate(duration);

    // Create ban record atomically with explicit conflict target
    let insertedBan;

    try {
      insertedBan = await db
        .insert(userBansTable)
        .values({
          userId,
          reason,
          expiresAt,
        })
        .onConflictDoNothing({ target: [userBansTable.userId] })
        .returning({ id: userBansTable.id });
    } catch (error) {
      console.error("Database error while creating ban record:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to create ban record",
        500
      );
    }

    if (insertedBan.length === 0) {
      throw new ServerError(
        "USER_ALREADY_BANNED",
        "User is already banned",
        409
      );
    }

    console.log(
      `User ${userId} has been banned for: ${reason}${
        duration ? ` (expires: ${expiresAt})` : " (permanent)"
      }`
    );

    // Dispatch kick user event to notify WebSocket service
    const kickUserEvent = new CustomEvent(KICK_USER_EVENT, {
      detail: {
        userId,
      },
    });

    dispatchEvent(kickUserEvent);
  }

  public async unbanUser(userId: string): Promise<void> {
    const db = this.databaseService.get();

    const deleted = await db
      .delete(userBansTable)
      .where(eq(userBansTable.userId, userId))
      .returning();

    if (deleted.length === 0) {
      throw new ServerError(
        "USER_NOT_BANNED",
        `User with id ${userId} is not banned`,
        404
      );
    }

    console.log(`User ${userId} has been unbanned`);
  }

  public async reportUser(
    reporterUserId: string,
    body: ReportUserRequest
  ): Promise<void> {
    const { userId, reason, automatic } = body;

    if (reporterUserId === userId) {
      throw new ServerError("INVALID_REPORT", "Cannot report yourself", 400);
    }

    const db = this.databaseService.get();

    // Check if user exists
    await this.checkUserExists(userId);

    // Insert report into database
    try {
      await db.insert(userReportsTable).values({
        reporterUserId,
        reportedUserId: userId,
        reason,
        automatic,
      });
    } catch (error) {
      console.error("Database error while creating report:", error);
      throw new ServerError("DATABASE_ERROR", "Failed to create report", 500);
    }
  }

  public async getUserReports(
    params: GetUserReportsRequest
  ): Promise<GetUserReportsResponse> {
    const { userId, cursor, limit = 20 } = params;
    const db = this.databaseService.get();

    // Check if user exists
    await this.checkUserExists(userId);

    // Build query conditions
    const conditions = [eq(userReportsTable.reportedUserId, userId)];

    if (cursor) {
      conditions.push(gt(userReportsTable.id, cursor));
    }

    // Fetch one extra item to determine if there are more results
    const reports = await db
      .select({
        id: userReportsTable.id,
        reporterUserId: userReportsTable.reporterUserId,
        reportedUserId: userReportsTable.reportedUserId,
        reason: userReportsTable.reason,
        automatic: userReportsTable.automatic,
      })
      .from(userReportsTable)
      .where(conditions.length > 1 ? and(...conditions) : conditions[0])
      .orderBy(userReportsTable.id)
      .limit(limit + 1);

    // Remove the extra item and use it to determine if there are more results
    const hasNextPage = reports.length > limit;
    const results = reports.slice(0, limit);

    return {
      data: results.map((report) => ({
        id: report.id,
        reporterUserId: report.reporterUserId,
        reportedUserId: report.reportedUserId,
        reason: report.reason,
        automatic: report.automatic,
      })),
      nextCursor: hasNextPage ? reports[reports.length - 1].id : undefined,
      hasMore: hasNextPage,
    };
  }

  public async getUserBans(
    params: GetUserBansRequest
  ): Promise<GetUserBansResponse> {
    const { userId, cursor, limit = 20 } = params;
    const db = this.databaseService.get();

    // Check if user exists
    await this.checkUserExists(userId);

    // Build query conditions
    const conditions = [eq(userBansTable.userId, userId)];

    if (cursor) {
      conditions.push(gt(userBansTable.id, cursor));
    }

    // Fetch one extra item to determine if there are more results
    const bans = await db
      .select({
        id: userBansTable.id,
        userId: userBansTable.userId,
        reason: userBansTable.reason,
        createdAt: userBansTable.createdAt,
        updatedAt: userBansTable.updatedAt,
        expiresAt: userBansTable.expiresAt,
      })
      .from(userBansTable)
      .where(conditions.length > 1 ? and(...conditions) : conditions[0])
      .orderBy(userBansTable.id)
      .limit(limit + 1);

    // Remove the extra item and use it to determine if there are more results
    const hasNextPage = bans.length > limit;
    const results = bans.slice(0, limit);

    return {
      data: results.map((ban) => ({
        id: ban.id,
        userId: ban.userId,
        reason: ban.reason,
        createdAt: ban.createdAt.toISOString(),
        updatedAt: ban.updatedAt?.toISOString() || null,
        expiresAt: ban.expiresAt?.toISOString() || null,
      })),
      nextCursor: hasNextPage ? bans[bans.length - 1].id : undefined,
      hasMore: hasNextPage,
    };
  }

  private async checkUserExists(userId: string): Promise<void> {
    const db = this.databaseService.get();

    try {
      const users = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1);

      if (users.length === 0) {
        throw new ServerError("USER_NOT_FOUND", "User not found", 404);
      }
    } catch (error) {
      if (error instanceof ServerError) {
        throw error;
      }

      console.error("Database error while checking user existence:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to verify user existence",
        500
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
        400
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
          400
        );
    }
  }
}
