import { inject, injectable } from "@needle-di/core";
import { NotificationService } from "./notification-service.ts";
import { ServerMessagesService } from "./server-messages-service.ts";
import { DiscordRestService } from "./discord-rest-service.ts";
import {
  NotificationChannelName,
  NotificationChannelNameToType,
} from "../enums/notification-channel-enum.ts";
import { EMBED_COLORS } from "../constants/discord-command-constants.ts";
import { ENV_DISCORD_ALLOWED_ROLE_NAMES } from "../constants/environment-constants.ts";
import {
  DiscordCommandOptionType,
} from "../enums/discord-command-option-enum.ts";
import { DiscordInteractionResponseType } from "../enums/discord-interaction-response-enum.ts";
import type { DiscordEmbed } from "../types/discord-embed-type.ts";
import type { DiscordInteractionOption } from "../types/discord-interaction-option-type.ts";
import type { DiscordInteractionPayload } from "../types/discord-interaction-payload-type.ts";
import type { DiscordInteractionResponse } from "../types/discord-interaction-response-type.ts";

@injectable()
export class DiscordCommandService {
  constructor(
    private serverMessagesService = inject(ServerMessagesService),
    private notificationService = inject(NotificationService),
    private discordRestService = inject(DiscordRestService),
  ) {}

  public async handle(
    interaction: DiscordInteractionPayload,
  ): Promise<DiscordInteractionResponse> {
    const name = interaction.data?.name;
    if (!name) return this.errorResponse("Unknown Command");

    const authorized = await this.isAuthorized(interaction);
    if (!authorized) {
      return this.errorResponse(
        "No Permission",
        `You need the ${
          this.getAllowedRoleNames().join(", ")
        } role to use this command.`,
      );
    }

    try {
      switch (name) {
        case "alert":
          return this.handleAlert(interaction);
        case "news":
          return await this.handleNews(interaction);
        default:
          return this.errorResponse("Unknown Command");
      }
    } catch (e) {
      console.error(`discord interaction error /${name}:`, e);
      return this.errorResponse("Error", this.errorMessage(e));
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
      return await Promise.resolve(false);
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

  private handleAlert(
    interaction: DiscordInteractionPayload,
  ): DiscordInteractionResponse {
    const values = this.optionValues(interaction.data?.options);
    const text = String(values.get("text") ?? "").trim();
    const channel = this.resolveChannel(
      String(values.get("channel") ?? "GLOBAL"),
    );

    if (!text) {
      return this.errorResponse("Alert", "The alert text cannot be empty.");
    }

    try {
      this.notificationService.notify(
        NotificationChannelNameToType[channel],
        text,
      );
      return this.successResponse(
        "Alert Sent",
        `Flash news pushed to **${channel}** players.\n\n${text}`,
      );
    } catch (e) {
      return this.errorResponse("Alert Failed", this.errorMessage(e));
    }
  }

  private async handleNews(
    interaction: DiscordInteractionPayload,
  ): Promise<DiscordInteractionResponse> {
    const { sub, values } = this.subcommandOptions(interaction);

    switch (sub) {
      case "create": {
        const title = String(values.get("title") ?? "").trim();
        const content = String(values.get("content") ?? "").trim();
        if (!title || !content) {
          return this.errorResponse(
            "Create News",
            "Title and content are required.",
          );
        }
        try {
          await this.serverMessagesService.create({ title, content });
          return this.successResponse("News Created", undefined, [
            { name: "Title", value: title, inline: false },
            {
              name: "Content",
              value: this.contentSnippet(content),
              inline: false,
            },
          ]);
        } catch (e) {
          return this.errorResponse("Create News Failed", this.errorMessage(e));
        }
      }

      case "update": {
        const id = Number(values.get("id"));
        const title = String(values.get("title") ?? "").trim();
        const content = String(values.get("content") ?? "").trim();
        if (!Number.isInteger(id) || id <= 0 || !title || !content) {
          return this.errorResponse(
            "Update News",
            "A valid ID, title, and content are required.",
          );
        }
        try {
          await this.serverMessagesService.update({ id, title, content });
          return this.successResponse(
            "News Updated",
            `Updated **#${id}**`,
            [
              { name: "Title", value: title, inline: false },
              {
                name: "Content",
                value: this.contentSnippet(content),
                inline: false,
              },
            ],
          );
        } catch (e) {
          return this.errorResponse("Update News Failed", this.errorMessage(e));
        }
      }

      case "delete": {
        const id = Number(values.get("id"));
        if (!Number.isInteger(id) || id <= 0) {
          return this.errorResponse(
            "Delete News",
            "A valid news ID is required.",
          );
        }
        try {
          await this.serverMessagesService.delete(id);
          return this.successResponse(
            "News Deleted",
            `Deleted **#${id}**`,
          );
        } catch (e) {
          return this.errorResponse("Delete News Failed", this.errorMessage(e));
        }
      }

      case "list": {
        try {
          const list = await this.serverMessagesService.list({ limit: 25 });
          if (list.results.length === 0) {
            return this.infoResponse("News", "No news items yet.");
          }
          return this.infoResponse(
            `News (${list.results.length})`,
            undefined,
            list.results.map((item) => ({
              name: `#${item.id} — ${item.title}`,
              value: this.contentSnippet(item.content),
              inline: false,
            })),
          );
        } catch (e) {
          return this.errorResponse("List News Failed", this.errorMessage(e));
        }
      }

      default:
        return this.errorResponse("News", "Unknown subcommand.");
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

  private subcommandOptions(
    interaction: DiscordInteractionPayload,
  ): { sub: string | undefined; values: Map<string, unknown> } {
    const options = interaction.data?.options;
    const sub = options?.find(
      (option) => option.type === DiscordCommandOptionType.SubCommand,
    );
    if (!sub) {
      return { sub: undefined, values: this.optionValues(options) };
    }
    return { sub: sub.name, values: this.optionValues(sub.options) };
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

  private contentSnippet(content: string): string {
    const singleLine = content.replace(/\s+/g, " ").trim();
    return singleLine.length > 100
      ? singleLine.slice(0, 97) + "..."
      : singleLine;
  }

  private errorMessage(e: unknown): string {
    if (e instanceof Error) return e.message.slice(0, 1500);
    return String(e).slice(0, 1500);
  }

  private successResponse(
    title: string,
    description?: string,
    fields?: DiscordEmbed["fields"],
  ): DiscordInteractionResponse {
    return this.embed({
      title,
      description,
      color: EMBED_COLORS.success,
      fields,
    });
  }

  private infoResponse(
    title: string,
    description?: string,
    fields?: DiscordEmbed["fields"],
  ): DiscordInteractionResponse {
    return this.embed({
      title,
      description,
      color: EMBED_COLORS.info,
      fields,
    });
  }

  private errorResponse(
    title: string,
    description?: string,
  ): DiscordInteractionResponse {
    return this.embed({
      title,
      description,
      color: EMBED_COLORS.error,
    });
  }

  private embed(embed: DiscordEmbed): DiscordInteractionResponse {
    return {
      type: DiscordInteractionResponseType.ChannelMessageWithSource,
      data: {
        embeds: [embed],
        flags: 64,
      },
    };
  }
}
