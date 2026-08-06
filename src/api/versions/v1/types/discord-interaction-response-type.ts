import type { DiscordEmbed } from "./discord-embed-type.ts";

export type DiscordInteractionResponse = {
  type: number;
  data: { embeds?: DiscordEmbed[]; flags?: number };
};
