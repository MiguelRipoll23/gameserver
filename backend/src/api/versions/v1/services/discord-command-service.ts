import { inject, injectable } from "@needle-di/core";
import { Logger } from "../../../../core/utils/logger.ts";
import { NotificationService } from "./notification-service.ts";
import { DiscordRestService } from "./discord-rest-service.ts";
import { UserModerationService } from "./user-moderation-service.ts";
import {
  NotificationChannelName,
  NotificationChannelNameToType,
} from "../enums/notification-channel-enum.ts";
import { ENV_DISCORD_ALLOWED_ROLE_NAMES } from "../constants/environment-constants.ts";
import { env } from "cloudflare:workers";
import { DiscordInteractionResponseType } from "../enums/discord-interaction-response-enum.ts";
import { BanUserRequestSchema } from "../schemas/user-moderation-schemas.ts";
import { ServerError } from "../models/server-error.ts";
import type { DiscordInteractionOption } from "../types/discord-interaction-option-type.ts";
import type { DiscordInteractionPayload } from "../types/discord-interaction-payload-type.ts";
import type { DiscordInteractionResponse } from "../types/discord-interaction-response-type.ts";

@injectable()
export class DiscordCommandService {
  private static readonly GENERIC_ERROR_MESSAGE =
    "Something went wrong while processing your request.";

  constructor(
    private notificationService = inject(NotificationService),
    private userModerationService = inject(UserModerationService),
    private discordRestService = inject(DiscordRestService),
  ) {}

  public async handle(
    interaction: DiscordInteractionPayload,
  ): Promise<DiscordInteractionResponse> {
    const name = interaction.data?.name;
    if (!name) return this.errorResponse("Unknown command");

    let authorized: boolean;
    try {
      authorized = await this.isAuthorized(interaction);
    } catch (e) {
      Logger.error(
        `discord interaction authorization error /${name}:`,
        e instanceof Error ? e.message : String(e),
        e instanceof Error ? e.stack : undefined,
      );
      return this.errorResponse(
        "Authorization error",
        "Unable to verify your permissions right now. Please try again.",
      );
    }

    if (!authorized) {
      return this.errorResponse(
        "Not authorized",
        `You are not authorized to use this command. Only members with one of the following roles can use it: **${
          this.getAllowedRoleNames().join(", ")
        }**.`,
      );
    }

    try {
      switch (name) {
        case "notification":
          return await this.handleNotification(interaction);
        case "ban-player":
          return await this.handleBanPlayer(interaction);
        case "unban-player":
          return await this.handleUnbanPlayer(interaction);
        default:
          return this.errorResponse("Unknown command");
      }
    } catch (e) {
      Logger.error(
        `discord interaction error /${name}:`,
        e instanceof Error ? e.message : String(e),
        e instanceof Error ? e.stack : undefined,
      );
      return this.errorResponse(
        "Error",
        DiscordCommandService.GENERIC_ERROR_MESSAGE,
      );
    }
  }

  private async isAuthorized(
    interaction: DiscordInteractionPayload,
  ): Promise<boolean> {
    const allowed = this.getAllowedRoleNames();
    if (allowed.length === 0) return false;

    const guildId = interaction.guildId;
    const memberRoleIds = interaction.member?.roles;
    if (!guildId || !memberRoleIds || memberRoleIds.length === 0) {
      return false;
    }

    return await this.discordRestService.hasAllowedRole(
      guildId,
      memberRoleIds,
      allowed,
    );
  }

  private getAllowedRoleNames(): string[] {
    return (
      env[ENV_DISCORD_ALLOWED_ROLE_NAMES] || "moderator,manager"
    ).split(",").map((name) => name.trim()).filter(Boolean);
  }

  private async handleNotification(
    interaction: DiscordInteractionPayload,
  ): Promise<DiscordInteractionResponse> {
    const values = this.optionValues(interaction.data?.options);
    const text = String(values.get("text") ?? "").trim();
    const channel = this.resolveChannel(
      String(values.get("channel") ?? "GLOBAL"),
    );

    if (!text) {
      return this.errorResponse(
        "Notification",
        "The notification text cannot be empty.",
      );
    }

    try {
      await this.notificationService.notify(
        NotificationChannelNameToType[channel],
        text,
      );
      return this.successResponse(
        "Notification sent",
        `Notification pushed to **${channel}** channel: ${this.singleLine(text)}`,
      );
    } catch (e) {
      Logger.error(
        "discord notification failed:",
        e instanceof Error ? e.message : String(e),
        e instanceof Error ? e.stack : undefined,
      );
      return this.errorResponse(
        "Notification failed",
        DiscordCommandService.GENERIC_ERROR_MESSAGE,
      );
    }
  }

  private async handleBanPlayer(
    interaction: DiscordInteractionPayload,
  ): Promise<DiscordInteractionResponse> {
    const values = this.optionValues(interaction.data?.options);
    const playerName = String(values.get("player-name") ?? "").trim();
    const reason = String(values.get("reason") ?? "").trim();
    const durationValue = values.get("duration-value");
    const durationUnit = values.get("duration-unit");

    if (!playerName || !reason) {
      return this.errorResponse(
        "Ban player",
        "Player name and reason are required.",
      );
    }

    if ((durationValue === undefined) !== (durationUnit === undefined)) {
      return this.errorResponse(
        "Ban player",
        "Provide both duration-value and duration-unit, or omit both for a permanent ban.",
      );
    }

    const duration = durationValue === undefined ? undefined : {
      value: Number(durationValue),
      unit: String(durationUnit) as
        | "minutes"
        | "hours"
        | "days"
        | "weeks"
        | "months"
        | "years",
    };

    const user = await this.userModerationService.getUserByDisplayName(
      playerName,
    );

    if (!user) {
      return this.errorResponse(
        "Ban player failed",
        `Player **${playerName}** was not found.`,
      );
    }

    const banRequest = BanUserRequestSchema.safeParse({
      userId: user.id,
      reason,
      duration,
    });

    if (!banRequest.success) {
      return this.errorResponse(
        "Ban player",
        banRequest.error.issues[0]?.message ?? "Invalid ban request.",
      );
    }

    try {
      await this.userModerationService.banUser(banRequest.data);
      return this.successResponse(
        "Player banned",
        `Player **${this.singleLine(user.displayName)}** banned due to **${
          this.singleLine(reason)
        }** ${this.describeBanDuration(duration)}`,
      );
    } catch (e) {
      if (e instanceof ServerError) {
        return this.errorResponse("Ban player failed", e.message);
      }

      Logger.error(
        "discord ban player failed:",
        e instanceof Error ? e.message : String(e),
        e instanceof Error ? e.stack : undefined,
      );
      return this.errorResponse(
        "Ban player failed",
        DiscordCommandService.GENERIC_ERROR_MESSAGE,
      );
    }
  }

  private async handleUnbanPlayer(
    interaction: DiscordInteractionPayload,
  ): Promise<DiscordInteractionResponse> {
    const values = this.optionValues(interaction.data?.options);
    const playerName = String(values.get("player-name") ?? "").trim();

    if (!playerName) {
      return this.errorResponse(
        "Unban player",
        "Player name is required.",
      );
    }

    const user = await this.userModerationService.getUserByDisplayName(
      playerName,
    );

    if (!user) {
      return this.errorResponse(
        "Unban player failed",
        `Player **${playerName}** was not found.`,
      );
    }

    try {
      await this.userModerationService.unbanUser(user.id);
      return this.successResponse(
        "Player unbanned",
        `Player **${this.singleLine(user.displayName)}** has been unbanned.`,
      );
    } catch (e) {
      if (e instanceof ServerError) {
        return this.errorResponse("Unban player failed", e.message);
      }

      Logger.error(
        "discord unban player failed:",
        e instanceof Error ? e.message : String(e),
        e instanceof Error ? e.stack : undefined,
      );
      return this.errorResponse(
        "Unban player failed",
        DiscordCommandService.GENERIC_ERROR_MESSAGE,
      );
    }
  }

  private optionValues(
    options: DiscordInteractionOption[] | undefined,
  ): Map<string, unknown> {
    const map = new Map<string, unknown>();
    for (const option of options ?? []) {
      if (option.name && option.value !== undefined) {
        map.set(option.name, option.value);
      }
    }
    return map;
  }

  private resolveChannel(value: string): NotificationChannelName {
    switch (value.toUpperCase()) {
      case NotificationChannelName.Menu:
        return NotificationChannelName.Menu;
      case NotificationChannelName.Match:
        return NotificationChannelName.Match;
      default:
        return NotificationChannelName.Global;
    }
  }

  private describeBanDuration(
    duration:
      | {
        value: number;
        unit: "minutes" | "hours" | "days" | "weeks" | "months" | "years";
      }
      | undefined,
  ): string {
    if (!duration) return "**permanently**";

    return `for **${duration.value} ${duration.unit}**`;
  }

  private successResponse(
    heading: string,
    description?: string,
  ): DiscordInteractionResponse {
    return this.textResponse(description ?? heading);
  }

  private errorResponse(
    heading: string,
    description?: string,
  ): DiscordInteractionResponse {
    return this.textResponse(`**Error:** ${description ?? heading}`);
  }

  private singleLine(value: string): string {
    return value.replace(/\s+/g, " ").trim();
  }

  private textResponse(content: string): DiscordInteractionResponse {
    return {
      type: DiscordInteractionResponseType.ChannelMessageWithSource,
      data: {
        content: this.singleLine(content),
        flags: 64,
      },
    };
  }
}
