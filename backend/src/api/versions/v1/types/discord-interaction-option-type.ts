export type DiscordInteractionOption = {
  name: string;
  type: number;
  value?: string | number;
  options?: DiscordInteractionOption[];
};
