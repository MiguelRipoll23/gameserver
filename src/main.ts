import { Container } from "@needle-di/core";
import { HTTPService } from "./core/services/http-service.ts";
import { logDiscordBotConfiguration } from "./api/versions/v1/utils/discord-bot-config-utils.ts";

// Re-export the Durable Object so it is included in the Worker bundle and the
// `WEBSOCKET_V1_DO` binding resolves to it.
export { V1WebSocketDurableObject } from "./api/versions/v1/durable-objects/v1-web-socket-durable-object.ts";

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
} satisfies ExportedHandler<Env>;
