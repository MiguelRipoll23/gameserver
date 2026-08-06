import { DiscordInteractionResponseType } from "../enums/discord-interaction-response-enum.ts";
import type { DiscordEmbed } from "./discord-embed-type.ts";

export type DiscordInteractionResponse = {
  type: DiscordInteractionResponseType;
  data?: { content?: string; embeds?: DiscordEmbed[]; flags?: number };
};
