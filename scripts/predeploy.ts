import { pathToFileURL } from "node:url";
import { Logger } from "../src/core/utils/logger.ts";
import { migrateDatabase } from "./migrate-database.ts";
import { registerDiscordCommands } from "./register-discord-commands.ts";

async function predeploy(): Promise<void> {
  await migrateDatabase();
  await registerDiscordCommands();
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