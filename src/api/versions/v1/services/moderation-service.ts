import { inject, injectable } from "@needle-di/core";
import { KVService } from "../../../../core/services/kv-service.ts";
import { ServerError } from "../models/server-error.ts";
import { BanInformation } from "../interfaces/kv/user-kv.ts";
import { BanUserRequest } from "../schemas/moderation-schemas.ts";
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
        expiresAt = TimeUtils.parseRelativeTime(duration);
      } catch {
        throw new ServerError(
          "INVALID_DURATION",
          "Invalid ban duration format",
          400,
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
}
