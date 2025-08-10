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
    let users;

    try {
      users = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1);
    } catch (error) {
      console.error("Database error while checking user existence:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to verify user existence",
        500
      );
    }

    if (users.length === 0) {
      throw new ServerError("USER_NOT_FOUND", "User not found", 404);
    }

    // Calculate expiration date
    const expiresAt = this.calculateExpirationDate(duration);

    // Create ban record atomically
    try {
      const result = await db
        .insert(userBansTable)
        .values({
          userId: userId,
          reason: reason,
          expiresAt: expiresAt,
        })
        .onConflictDoNothing();
      if (result.rowCount === 0) {
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

    // Check if user exists
    let users;

    try {
      users = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1);
    } catch (error) {
      console.error("Database error while checking user existence:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to verify user existence",
        500
      );
    }

    if (users.length === 0) {
      throw new ServerError("USER_NOT_FOUND", "User not found", 404);
    }

    // Check if user is actually banned
    let existingBan;

    try {
      existingBan = await db
        .select()
        .from(userBansTable)
        .where(eq(userBansTable.userId, userId))
        .limit(1);
    } catch (error) {
      console.error("Database error while checking ban status:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to check ban status",
        500
      );
    }

    if (existingBan.length === 0) {
      throw new ServerError("USER_NOT_BANNED", "User is not banned", 404);
    }

    // Remove ban record
    try {
      await db.delete(userBansTable).where(eq(userBansTable.userId, userId));
    } catch (error) {
      console.error("Database error while removing ban:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to remove ban record",
        500
      );
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
    let users;

    try {
      users = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1);
    } catch (error) {
      console.error("Database error while checking user existence:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to verify user existence",
        500
      );
    }

    if (users.length === 0) {
      throw new ServerError("USER_NOT_FOUND", "User not found", 404);
    }

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
