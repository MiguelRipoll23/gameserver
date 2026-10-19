import { inject, injectable } from "@needle-di/core";
import { Logger } from "../../../../core/utils/logger.ts";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { ServerError } from "../models/server-error.ts";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  AutomaticReportUserRequest,
  BanDuration,
  BanUserRequest,
  ManualReportUserRequest,
} from "../schemas/user-moderation-schemas.ts";
import {
  userBansTable,
  userReportsAutomaticTable,
  userReportsManualTable,
  usersTable,
} from "../../../../db/schema.ts";
import { desc, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { WEBSOCKET_DURABLE_OBJECT_NAME } from "../constants/durable-object-constants.ts";

/**
 * Player-facing moderation data.
 *
 * This service only owns what game clients need: filing reports and learning
 * whether the authenticated player is currently banned. Reviewing reports and
 * issuing bans is handled by the separate `gameserver-console` backend, which
 * writes to the same database.
 */
@injectable()
export class UserModerationService {
  constructor(private databaseService = inject(DatabaseService)) {}

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

  /**
   * Returns the active ban for a user, or `null` when the player is not banned.
   */
  public async getActiveBan(
    userId: string,
  ): Promise<{ reason: string; expiresAt: string | null } | null> {
    const rows = await this.databaseService
      .get()
      .select({
        reason: userBansTable.reason,
        expiresAt: userBansTable.expiresAt,
      })
      .from(userBansTable)
      .where(eq(userBansTable.userId, userId))
      .orderBy(desc(userBansTable.createdAt))
      .limit(1);

    if (rows.length === 0) return null;

    const latestBan = rows[0];
    if (latestBan.expiresAt && latestBan.expiresAt <= new Date()) {
      return null;
    }

    return {
      reason: latestBan.reason,
      expiresAt: latestBan.expiresAt?.toISOString() ?? null,
    };
  }

  /**
   * Bans a user.
   *
   * Only the Discord bot uses this path on the gameserver: the HTTP ban
   * endpoints live in the `gameserver-console` backend. Keeping the write here
   * lets `/ban-player` see the ban through immediately (it runs in this Worker
   * and needs the local Durable Object to kick the player).
   */
  public async banUser(
    body: BanUserRequest,
    issuedByUserId?: string,
  ): Promise<void> {
    const { userId, reason, duration } = body;
    const db = this.databaseService.get();
    const expiresAt = this.calculateExpirationDate(duration);

    try {
      await db.transaction(async (tx) => {
        await this.checkUserExists(tx, userId, true);

        const existingBans = await tx
          .select({ id: userBansTable.id, expiresAt: userBansTable.expiresAt })
          .from(userBansTable)
          .where(eq(userBansTable.userId, userId))
          .orderBy(desc(userBansTable.createdAt))
          .limit(1);

        if (existingBans.length > 0) {
          const existingBan = existingBans[0];

          if (!existingBan.expiresAt || existingBan.expiresAt > new Date()) {
            throw new ServerError(
              "USER_ALREADY_BANNED",
              "User is already banned",
              409,
            );
          }
        }

        await tx.insert(userBansTable).values({
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
    await env.WEBSOCKET_DURABLE_OBJECT.getByName(
      WEBSOCKET_DURABLE_OBJECT_NAME,
    ).kickPlayer(userId);
  }

  /** Removes the latest ban for a user (used by the Discord `/unban-player`). */
  public async unbanUser(userId: string): Promise<void> {
    const db = this.databaseService.get();

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

    const ban = latestBan[0];
    if (ban.expiresAt && ban.expiresAt <= new Date()) {
      throw new ServerError(
        "USER_NOT_BANNED",
        `User with id ${userId} is not banned`,
        404,
      );
    }

    await db.delete(userBansTable).where(eq(userBansTable.id, ban.id));

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

  private calculateExpirationDate(duration?: BanDuration): Date | null {
    if (!duration) {
      return null; // Permanent ban
    }

    const now = new Date();
    const { value, unit } = duration;

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
}
