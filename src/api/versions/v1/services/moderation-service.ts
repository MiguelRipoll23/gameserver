import { inject, injectable } from "@needle-di/core";
import { KVService } from "../../../../core/services/kv-service.ts";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { ServerError } from "../models/server-error.ts";
import {
  BanUserRequest,
  ReportUserRequest,
} from "../schemas/moderation-schemas.ts";
import { usersTable, userReportsTable } from "../../../../db/schema.ts";
import { eq } from "drizzle-orm";

@injectable()
export class ModerationService {
  constructor(
    private kvService = inject(KVService),
    private databaseService = inject(DatabaseService)
  ) {}

  public async banUser(body: BanUserRequest): Promise<void> {
    const { userId, reason, duration: _duration } = body;
    const db = this.databaseService.get();
    const users = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (users.length === 0) {
      throw new ServerError("USER_NOT_FOUND", "User not found", 404);
    }

    // Note: Ban information is not currently stored in PostgreSQL schema
    // This would need to be added to the usersTable schema if needed
    // For now, we'll comment out the ban logic
    console.log(`User ${userId} would be banned for: ${reason}`);

    // TODO: Add ban fields to users table schema and implement ban logic
  }

  public async unbanUser(userId: string): Promise<void> {
    const db = this.databaseService.get();
    const users = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (users.length === 0) {
      throw new ServerError("USER_NOT_FOUND", "User not found", 404);
    }

    // Note: Ban information is not currently stored in PostgreSQL schema
    // For now, we'll just log the unban action
    console.log(`User ${userId} would be unbanned`);

    // TODO: Add ban fields to users table schema and implement unban logic
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
    const users = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (users.length === 0) {
      throw new ServerError("USER_NOT_FOUND", "User not found", 404);
    }

    // Insert report into database
    await db.insert(userReportsTable).values({
      userId: userId,
      reason: reason,
      automatic: automatic,
    });
  }
}
