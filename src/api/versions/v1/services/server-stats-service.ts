import { inject, injectable } from "@needle-di/core";
import { GetStatsResponse } from "../schemas/stats-schemas.ts";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { userSessionsTable } from "../../../../db/schema.ts";

@injectable()
export class ServerStatsService {
  constructor(private readonly databaseService = inject(DatabaseService)) {}

  public async get(): Promise<GetStatsResponse> {
    const totalSessions = await this.getTotalSessions();
    const stats: GetStatsResponse = {
      totalSessions,
    };

    return stats;
  }

  private async getTotalSessions(): Promise<number> {
    const db = this.databaseService.get();
    return await db.$count(userSessionsTable);
  }
}
