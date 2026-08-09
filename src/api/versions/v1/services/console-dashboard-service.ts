import { inject, injectable } from "@needle-di/core";
import { count, desc, gt, type SQL } from "drizzle-orm";
import type { AnyPgTable } from "drizzle-orm/pg-core";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { ServerError } from "../models/server-error.ts";
import { VersionService } from "./version-service.ts";
import {
  antiCheatRulesTable,
  blockedWordsTable,
  botsTable,
  matchesTable,
  serverMessagesTable,
  userBansTable,
  userReportsTable,
  userScoresTable,
  userSessionsTable,
  usersTable,
} from "../../../../db/schema.ts";
import type { GetConsoleDashboardResponse } from "../schemas/console-dashboard-schemas.ts";

@injectable()
export class ConsoleDashboardService {
  constructor(
    private databaseService = inject(DatabaseService),
    private versionService = inject(VersionService),
  ) {}

  /**
   * Gathers every piece of data shown on the management console dashboard in
   * a single request, so the console no longer fans out to many endpoints.
   */
  public async get(): Promise<GetConsoleDashboardResponse> {
    const db = this.databaseService.get();

    let minimumVersion: string | null = null;
    try {
      minimumVersion = (await this.versionService.get()).minimumVersion;
    } catch (error) {
      if (error instanceof ServerError && error.getCode() === "MISSING_VERSION") {
        minimumVersion = null;
      } else {
        throw error;
      }
    }

    const [
      usersCount,
      botsCount,
      sessionsCount,
      matchesCount,
      scoresCount,
      reportsCount,
      bansCount,
      blockedWordsCount,
      antiCheatRulesCount,
    ] = await Promise.all([
      this.countRows(usersTable),
      this.countRows(botsTable),
      this.countRows(userSessionsTable),
      this.countRows(matchesTable, gt(matchesTable.availableSlots, 0)),
      this.countRows(userScoresTable),
      this.countRows(userReportsTable),
      this.countRows(userBansTable),
      this.countRows(blockedWordsTable),
      this.countRows(antiCheatRulesTable),
    ]);

    const [latestMessage] = await db
      .select()
      .from(serverMessagesTable)
      .orderBy(desc(serverMessagesTable.id))
      .limit(1);

    return {
      minimumVersion,
      usersCount,
      botsCount,
      sessionsCount,
      matchesCount,
      scoresCount,
      reportsCount,
      bansCount,
      blockedWordsCount,
      antiCheatRulesCount,
      latestServerMessage: latestMessage
        ? {
            id: latestMessage.id,
            title: latestMessage.title,
            content: latestMessage.content,
            createdAt: latestMessage.createdAt.getTime(),
          }
        : null,
    };
  }

  private async countRows(
    table: AnyPgTable,
    filter?: SQL | undefined,
  ): Promise<number> {
    const query = this.databaseService
      .get()
      .select({ value: count() })
      .from(table);

    const rows = filter ? await query.where(filter) : await query;

    return Number(rows[0]?.value ?? 0);
  }
}
