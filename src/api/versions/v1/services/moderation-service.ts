import { inject, injectable } from "@needle-di/core";
import { KVService } from "../../../../core/services/kv-service.ts";
import { ServerError } from "../models/server-error.ts";
import { BanInformation } from "../interfaces/kv/user-kv.ts";
import {
  BanUserRequest,
  ReportUserRequest,
} from "../schemas/moderation-schemas.ts";
import { PlayerReportKV } from "../interfaces/kv/player-report-kv.ts";
import { TimeUtils } from "../utils/time-utils.ts";

@injectable()
export class ModerationService {
  constructor(private kvService = inject(KVService)) {}

  public async banUser(body: BanUserRequest): Promise<void> {
    const { userId, reason, duration } = body;
    const user = await this.kvService.getUser(userId);

    if (user === null) {
      throw new ServerError("USER_NOT_FOUND", "User not found", 404);
    }

    let expiresAt: number | null = null;
    if (duration) {
      try {
        expiresAt = TimeUtils.parseDuration(duration);
      } catch {
        throw new ServerError(
          "INVALID_DURATION",
          "Invalid ban duration format",
          400
        );
      }
    }

    const ban: BanInformation = {
      reason,
      expiresAt,
    };

    user.ban = ban;

    await this.kvService.setUser(userId, user);
  }

  public async unbanUser(userId: string): Promise<void> {
    const user = await this.kvService.getUser(userId);

    if (user === null) {
      throw new ServerError("USER_NOT_FOUND", "User not found", 404);
    }

    if (user.ban) {
      user.ban = undefined;
      await this.kvService.setUser(userId, user);
    }
  }

  public async reportUser(
    reporterId: string,
    body: ReportUserRequest
  ): Promise<void> {
    const { userId, reason, automatic } = body;
    if (reporterId === userId) {
      throw new ServerError("INVALID_REPORT", "Cannot report yourself", 400);
    }
    const user = await this.kvService.getUser(userId);

    if (user === null) {
      throw new ServerError("USER_NOT_FOUND", "User not found", 404);
    }

    const report: PlayerReportKV = { userId, reason, automatic };
    await this.kvService.setReport(reporterId, userId, report);
  }
}
