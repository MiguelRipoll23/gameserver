import type { DiscordSlashOptionPayload } from "./discord-slash-option-payload-type.ts";

export type DiscordSlashCommandPayload = {
  name: string;
  description: string;
  options?: DiscordSlashOptionPayload[];
};
