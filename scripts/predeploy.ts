import { migrateDatabase } from "./migrate-database.ts";
import { registerDiscordCommands } from "./register-discord-commands.ts";

await migrateDatabase();
await registerDiscordCommands();
