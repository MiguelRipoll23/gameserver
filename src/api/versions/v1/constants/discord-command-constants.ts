import { DiscordCommandOptionType } from "../enums/discord-command-option-enum.ts";
import type { DiscordSlashCommandPayload } from "../types/discord-slash-command-payload-type.ts";

export const EMBED_COLORS = {
  info: 0x5865F2,
  success: 0x57F287,
  error: 0xED4245,
} as const;

const SUB_COMMAND = DiscordCommandOptionType.SubCommand;
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
    name: "news",
    description: "Manage server news",
    options: [
      {
        type: SUB_COMMAND,
        name: "create",
        description: "Create a news item",
        options: [
          {
            name: "title",
            description: "News title",
            type: STRING,
            required: true,
          },
          {
            name: "content",
            description: "News content",
            type: STRING,
            required: true,
          },
        ],
      },
      {
        type: SUB_COMMAND,
        name: "update",
        description: "Update a news item",
        options: [
          {
            name: "id",
            description: "News ID",
            type: INTEGER,
            required: true,
          },
          {
            name: "title",
            description: "New title",
            type: STRING,
            required: true,
          },
          {
            name: "content",
            description: "New content",
            type: STRING,
            required: true,
          },
        ],
      },
      {
        type: SUB_COMMAND,
        name: "delete",
        description: "Delete a news item",
        options: [
          {
            name: "id",
            description: "News ID",
            type: INTEGER,
            required: true,
          },
        ],
      },
      {
        type: SUB_COMMAND,
        name: "list",
        description: "List all news items",
        options: [],
      },
    ],
  },
];