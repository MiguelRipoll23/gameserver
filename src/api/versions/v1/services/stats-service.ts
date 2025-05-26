import { inject, injectable } from "@needle-di/core";
import { GetStatsResponse } from "../schemas/stats-schemas.ts";
import { WebSocketService } from "./websocket-service.ts";

@injectable()
export class StatsService {
  constructor(private readonly webSocketService = inject(WebSocketService)) {}

  public get(): GetStatsResponse {
    const totalSessions = this.webSocketService.getTotalSessions();
    const stats: GetStatsResponse = {
      totalSessions,
    };

    return stats;
  }
}
