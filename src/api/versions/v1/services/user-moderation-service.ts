import { inject, injectable } from "@needle-di/core";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { ServerError } from "../models/server-error.ts";
import {
  BanUserRequest,
  ReportUserRequest,
  BanDuration,
} from "../schemas/moderation-schemas.ts";
import {
  usersTable,
  userReportsTable,
  userBansTable,
} from "../../../../db/schema.ts";
import { eq } from "drizzle-orm";

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
    try {
      const insertedBan = await db
        .insert(userBansTable)
        .values({
          userId: userId,
          reason: reason,
          expiresAt: expiresAt,
        })
        .onConflictDoNothing({ target: userBansTable.userId })
        .returning();

      if (insertedBan.length === 0) {
        throw new ServerError(
          "USER_ALREADY_BANNED",
          "User is already banned",
          409
        );
      }
    } catch (error) {
      console.error("Database error while creating ban record:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to create ban record",
        500
      );
    }

    console.log(
      `User ${userId} has been banned for: ${reason}${
        duration ? ` (expires: ${expiresAt})` : " (permanent)"
      }`
    );
  }

  public async unbanUser(userId: string): Promise<void> {
    const db = this.databaseService.get();

    // Perform atomic delete operation with returning to get deleted record
    let deletedBan;

    try {
      deletedBan = await db
        .delete(userBansTable)
        .where(eq(userBansTable.userId, userId))
        .returning();
    } catch (error) {
      console.error("Database error while removing ban:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to remove ban record",
        500
      );
    }

    // If no record was deleted, check if user exists to determine appropriate error
    if (deletedBan.length === 0) {
      await this.checkUserExists(userId);
    }

    console.log(`User ${userId} has been unbanned`);
  }

  public async reportUser(
    reporterId: string,
    body: ReportUserRequest
  ): Promise<void> {
    const { userId, reason, automatic } = body;

    if (reporterId === userId) {
      throw new ServerError("INVALID_REPORT", "Cannot report yourself", 400);
    }

    const db = this.databaseService.get();

    // Check if user exists
    await this.checkUserExists(userId);

    // Insert report into database
    try {
      await db.insert(userReportsTable).values({
        reporterUserId: reporterId,
        reportedUserId: userId,
        reason: reason,
        automatic: automatic,
      });
    } catch (error) {
      console.error("Database error while creating report:", error);
      throw new ServerError("DATABASE_ERROR", "Failed to create report", 500);
    }
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
