import { Container } from "@needle-di/core";
import { HTTPService } from "./core/services/http-service.ts";
import { DatabaseService } from "./core/services/database-service.ts";
import { registerCleanupAuthenticationChallengesCron } from "../crons/cleanup-authentication-challenges-cron.ts";
import { registerCleanupRefreshTokensCron } from "../crons/cleanup-refresh-tokens-cron.ts";
import { registerCleanupUserSessionsCron } from "../crons/cleanup-user-sessions-cron.ts";
import { logDiscordBotConfiguration } from "./api/versions/v1/utils/discord-bot-config-utils.ts";

const container = new Container();

const databaseService = container.get(DatabaseService);
databaseService.init();

logDiscordBotConfiguration();

registerCleanupAuthenticationChallengesCron(databaseService);
registerCleanupRefreshTokensCron(databaseService);
registerCleanupUserSessionsCron(databaseService);

const httpService = container.get(HTTPService);
await httpService.listen();
