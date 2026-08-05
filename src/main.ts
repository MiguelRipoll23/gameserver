import { Container } from "@needle-di/core";
import { HTTPService } from "./core/services/http-service.ts";
import { DatabaseService } from "./core/services/database-service.ts";
import { registerCleanupAuthenticationChallengesCron } from "../crons/cleanup-authentication-challenges-cron.ts";
import { registerCleanupRefreshTokensCron } from "../crons/cleanup-refresh-tokens-cron.ts";
import { registerCleanupUserSessionsCron } from "../crons/cleanup-user-sessions-cron.ts";

const container = new Container();

const databaseService = container.get(DatabaseService);
databaseService.init();

registerCleanupAuthenticationChallengesCron(databaseService);
registerCleanupRefreshTokensCron(databaseService);
registerCleanupUserSessionsCron(databaseService);

const httpService = container.get(HTTPService);
await httpService.listen();
