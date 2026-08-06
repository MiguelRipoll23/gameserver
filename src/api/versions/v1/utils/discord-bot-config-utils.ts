import {
  ENV_DISCORD_BOT_TOKEN,
  ENV_DISCORD_PUBLIC_KEY,
} from "../constants/environment-constants.ts";

export function logDiscordBotConfiguration(): void {
  const missing: string[] = [];
  if (!Deno.env.get(ENV_DISCORD_PUBLIC_KEY)) {
    missing.push(ENV_DISCORD_PUBLIC_KEY);
  }
  if (!Deno.env.get(ENV_DISCORD_BOT_TOKEN)) {
    missing.push(ENV_DISCORD_BOT_TOKEN);
  }

  if (missing.length > 0) {
    console.warn(
      `[discord-bot] not configured (missing ${missing.join(", ")}); ` +
        "slash command endpoints will be disabled",
    );
    return;
  }

  console.log("[discord-bot] Discord bot configured");
}