import { DiscordInteractionResponseType } from "../enums/discord-interaction-response-enum.ts";
import type { DiscordEmbed } from "./discord-embed-type.ts";

export type DiscordInteractionResponse = {
  type: DiscordInteractionResponseType;
  data?: { embeds?: DiscordEmbed[]; flags?: number };
};
