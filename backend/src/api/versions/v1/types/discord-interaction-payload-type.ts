import type { DiscordInteractionOption } from "./discord-interaction-option-type.ts";

export type DiscordInteractionPayload = {
  id: string;
  token: string;
  type: number;
  guildId?: string;
  data?: {
    name?: string;
    type?: number;
    options?: DiscordInteractionOption[];
  };
  member?: { roles?: string[] };
  user?: { id?: string };
};
