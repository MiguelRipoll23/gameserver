import {
  ENV_DISCORD_APPLICATION_ID,
  ENV_DISCORD_BOT_TOKEN,
} from "../src/api/versions/v1/constants/environment-constants.ts";
import { DISCORD_SLASH_COMMANDS } from "../src/api/versions/v1/constants/discord-command-constants.ts";

export async function registerDiscordCommands(): Promise<void> {
  const applicationId = Deno.env.get(ENV_DISCORD_APPLICATION_ID);
  const botToken = Deno.env.get(ENV_DISCORD_BOT_TOKEN);

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
    console.log(`Registered ${DISCORD_SLASH_COMMANDS.length} global commands`);
    return;
  }

  const body = await resp.text();
  throw new Error(`Failed to register commands (HTTP ${resp.status}): ${body}`);
}

if (import.meta.main) {
  try {
    await registerDiscordCommands();
  } catch (error) {
    console.error(error);
    Deno.exit(1);
  }
}
