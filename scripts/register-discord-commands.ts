import { Logger } from "../src/core/utils/logger.ts";
import {
  ENV_DISCORD_APPLICATION_ID,
  ENV_DISCORD_BOT_TOKEN,
} from "../src/api/versions/v1/constants/environment-constants.ts";
import { DISCORD_SLASH_COMMANDS } from "../src/api/versions/v1/constants/discord-command-constants.ts";
import { pathToFileURL } from "node:url";

export async function registerDiscordCommands(): Promise<void> {
  const applicationId = process.env[ENV_DISCORD_APPLICATION_ID];
  const botToken = process.env[ENV_DISCORD_BOT_TOKEN];

  if (!applicationId || !botToken) {
    throw new Error(
      "DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN environment variables are required",
    );
  }

  const resp = await fetch(
    `https://discord.com/api/v10/applications/${applicationId}/commands`,
    {
      method: "PUT",
      headers: {
        "Authorization": `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(DISCORD_SLASH_COMMANDS),
    },
  );

  if (resp.ok) {
    Logger.log(`Registered ${DISCORD_SLASH_COMMANDS.length} global commands`);
    return;
  }

  const body = await resp.text();
  throw new Error(`Failed to register commands (HTTP ${resp.status}): ${body}`);
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  registerDiscordCommands()
    .then(() => process.exit(0))
    .catch((error) => {
      Logger.error(error);
      process.exit(1);
    });
}
