import {
  ENV_DISCORD_BOT_TOKEN,
  ENV_DISCORD_PUBLIC_KEY,
} from "../constants/environment-constants.ts";
import { env } from "cloudflare:workers";

export function logDiscordBotConfiguration(): void {
  const missing: string[] = [];
  if (!env[ENV_DISCORD_PUBLIC_KEY]) {
    missing.push(ENV_DISCORD_PUBLIC_KEY);
  }
  if (!env[ENV_DISCORD_BOT_TOKEN]) {
    missing.push(ENV_DISCORD_BOT_TOKEN);
  }

  if (missing.length > 0) {
    console.warn(
      `Discord bot not configured (missing ${missing.join(", ")}); ` +
        "slash command endpoints will be disabled",
    );
    return;
  }


}