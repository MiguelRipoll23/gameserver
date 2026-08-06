import {
  ENV_DISCORD_APPLICATION_ID,
  ENV_DISCORD_BOT_TOKEN,
} from "../src/api/versions/v1/constants/environment-constants.ts";
import { DISCORD_SLASH_COMMANDS } from "../src/api/versions/v1/constants/discord-command-constants.ts";

const applicationId = Deno.env.get(ENV_DISCORD_APPLICATION_ID);
const botToken = Deno.env.get(ENV_DISCORD_BOT_TOKEN);

if (!applicationId || !botToken) {
  console.error(
    "DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN environment variables are required",
  );
  Deno.exit(1);
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
} else {
  const body = await resp.text();
  console.error(`Failed to register commands (HTTP ${resp.status}): ${body}`);
  Deno.exit(1);
}
