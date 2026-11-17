import { pathToFileURL } from "node:url";
import { Logger } from "../src/core/utils/logger.ts";
import { migrateDatabase } from "./migrate-database.ts";
import { registerDiscordCommands } from "./register-discord-commands.ts";

async function predeploy(): Promise<void> {
  await migrateDatabase();
  await syncDiscordCommands();
}

/**
 * Slash-command registration is a convenience step, not a deployment
 * requirement: a revoked bot token or a Discord outage must not block the
 * Worker from shipping. Failures are logged so the misconfiguration stays
 * visible in the build output instead of silently disappearing.
 */
async function syncDiscordCommands(): Promise<void> {
  try {
    await registerDiscordCommands();
  } catch (error) {
    Logger.warn("Skipping Discord slash-command registration:", error);
  }
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  predeploy()
    .then(() => process.exit(0))
    .catch((error) => {
      Logger.error(error);
      process.exit(1);
    });
}