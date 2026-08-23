export type DiscordSlashOptionPayload = {
  name: string;
  description: string;
  type: number;
  required?: boolean;
  choices?: { name: string; value: string | number }[];
  options?: DiscordSlashOptionPayload[];
};
