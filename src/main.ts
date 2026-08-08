import { Container } from "@needle-di/core";
import { HTTPService } from "./core/services/http-service.ts";
import { DatabaseService } from "./core/services/database-service.ts";
import { AuthenticationChallengesService } from "./api/versions/v1/services/authentication-challenges-service.ts";
import { logDiscordBotConfiguration } from "./api/versions/v1/utils/discord-bot-config-utils.ts";

// Re-export the Durable Object so it is included in the Worker bundle and the
// `WEBSOCKET_V1_DO` binding resolves to it.
export { WebSocketDurableObject } from "./api/versions/v1/durable-objects/websocket-durable-object.ts";

const container = new Container();

let httpService: HTTPService | null = null;

function getHTTPService(): HTTPService {
  if (httpService === null) {
    logDiscordBotConfiguration();
    httpService = container.get(HTTPService);
  }

  return httpService;
}

export default {
  async fetch(request: Request, _env: Env): Promise<Response> {
    return getHTTPService().fetch(request);
  },

  async scheduled(_controller: ScheduledController, _env: Env): Promise<void> {
    const databaseService = container.get(DatabaseService);
    const challengesService = container.get(AuthenticationChallengesService);

    await databaseService.withConnection(async () => {
      const deleted = await challengesService.cleanupExpired();
      console.log(`Cleaned up ${deleted} expired authentication challenges`);
    });
  },
} satisfies ExportedHandler<Env>;
