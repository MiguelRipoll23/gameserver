import { inject, injectable } from "@needle-di/core";
import { NotificationService } from "./notification-service.ts";
import { DiscordRestService } from "./discord-rest-service.ts";
import { UserModerationService } from "./user-moderation-service.ts";
import {
  NotificationChannelName,
  NotificationChannelNameToType,
} from "../enums/notification-channel-enum.ts";
import { ENV_DISCORD_ALLOWED_ROLE_NAMES } from "../constants/environment-constants.ts";
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
      console.error(`discord interaction authorization error /${name}:`, e);
      return this.errorResponse(
        "Authorization error",
        "Unable to verify your permissions right now. Please try again.",
      );
    }

    if (!authorized) {
      return this.errorResponse(
        "Not authorized",
        `You are not authorized to use this command. Only members with one of the following roles can use it: ${
          this.getAllowedRoleNames().join(", ")
        }.`,
      );
    }

    try {
      switch (name) {
        case "notification":
          return this.handleNotification(interaction);
        case "ban-player":
          return await this.handleBanPlayer(interaction);
        default:
          return this.errorResponse("Unknown command");
      }
    } catch (e) {
      console.error(`discord interaction error /${name}:`, e);
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
      Deno.env.get(ENV_DISCORD_ALLOWED_ROLE_NAMES) || "moderator,manager"
    ).split(",").map((name) => name.trim()).filter(Boolean);
  }

  private handleNotification(
    interaction: DiscordInteractionPayload,
  ): DiscordInteractionResponse {
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
      this.notificationService.notify(
        NotificationChannelNameToType[channel],
        text,
      );
      return this.successResponse(
        "Notification sent",
        `Notification pushed to **${channel}** players.\n\n${text}`,
      );
    } catch (e) {
      console.error("discord notification failed:", e);
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
    const userId = String(values.get("user-id") ?? "").trim();
    const reason = String(values.get("reason") ?? "").trim();
    const durationValue = values.get("duration-value");
    const durationUnit = values.get("duration-unit");

    if (!userId || !reason) {
      return this.errorResponse(
        "Ban player",
        "User ID and reason are required.",
      );
    }

    if ((durationValue === undefined) !== (durationUnit === undefined)) {
      return this.errorResponse(
        "Ban player",
        "Provide both duration-value and duration-unit, or omit both for a permanent ban.",
      );
    }

    const duration = durationValue === undefined
      ? undefined
      : {
        value: Number(durationValue),
        unit: String(durationUnit) as
          | "minutes"
          | "hours"
          | "days"
          | "weeks"
          | "months"
          | "years",
      };

    const banRequest = BanUserRequestSchema.safeParse({
      userId,
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
        `Banned **${userId}** ${this.describeDuration(duration)} for: ${reason}`,
      );
    } catch (e) {
      if (e instanceof ServerError) {
        return this.errorResponse("Ban player failed", e.message);
      }

      console.error("discord ban player failed:", e);
      return this.errorResponse(
        "Ban player failed",
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

  private describeDuration(
    duration:
      | {
        value: number;
        unit: "minutes" | "hours" | "days" | "weeks" | "months" | "years";
      }
      | undefined,
  ): string {
    if (!duration) return "permanently";

    return `for ${duration.value} ${duration.unit}`;
  }

  private successResponse(
    heading: string,
    description?: string,
  ): DiscordInteractionResponse {
    return this.textResponse(this.withHeading(heading, description));
  }

  private errorResponse(
    heading: string,
    description?: string,
  ): DiscordInteractionResponse {
    return this.textResponse(this.withHeading(heading, description));
  }

  private withHeading(heading: string, description?: string): string {
    return description ? `**${heading}**\n\n${description}` : `**${heading}**`;
  }

  private textResponse(content: string): DiscordInteractionResponse {
    return {
      type: DiscordInteractionResponseType.ChannelMessageWithSource,
      data: {
        content,
        flags: 64,
      },
    };
  }
}
