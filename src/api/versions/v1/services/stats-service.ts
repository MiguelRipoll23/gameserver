import { inject, injectable } from "@needle-di/core";
import { GetStatsResponse } from "../schemas/stats-schemas.ts";
import { WebSocketService } from "./websocket-service.ts";

@injectable()
export class StatsService {
  constructor(private webSocketService = inject(WebSocketService)) {}

  public get(): GetStatsResponse {
    const totalOnlineUsers = this.webSocketService.getTotalSessions();

    const stats: GetStatsResponse = {
      total_sessions: totalOnlineUsers,
    };

    return stats;
  }
}
