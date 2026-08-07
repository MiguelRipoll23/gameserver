import { DiscordCommandOptionType } from "../enums/discord-command-option-enum.ts";
import type { DiscordSlashCommandPayload } from "../types/discord-slash-command-payload-type.ts";

const STRING = DiscordCommandOptionType.String;
const INTEGER = DiscordCommandOptionType.Integer;

export const DISCORD_SLASH_COMMANDS: DiscordSlashCommandPayload[] = [
  {
    name: "notification",
    description: "Send a notification to players in-game",
    options: [
      {
        name: "text",
        description: "The notification message to broadcast",
        type: STRING,
        required: true,
      },
      {
        name: "channel",
        description: "In-game notification channel (default: GLOBAL)",
        type: STRING,
        required: false,
        choices: [
          { name: "GLOBAL", value: "GLOBAL" },
          { name: "MENU", value: "MENU" },
          { name: "MATCH", value: "MATCH" },
        ],
      },
    ],
  },
  {
    name: "ban-player",
    description: "Temporarily or permanently ban a player",
    options: [
      {
        name: "player-name",
        description: "The player display name to ban",
        type: STRING,
        required: true,
      },
      {
        name: "reason",
        description: "Reason for the ban",
        type: STRING,
        required: true,
      },
      {
        name: "duration-value",
        description:
          "Duration value. Omit with duration-unit for a permanent ban",
        type: INTEGER,
        required: false,
      },
      {
        name: "duration-unit",
        description:
          "Duration unit. Omit with duration-value for a permanent ban",
        type: STRING,
        required: false,
        choices: [
          { name: "minutes", value: "minutes" },
          { name: "hours", value: "hours" },
          { name: "days", value: "days" },
          { name: "weeks", value: "weeks" },
          { name: "months", value: "months" },
          { name: "years", value: "years" },
        ],
      },
    ],
  },
];
