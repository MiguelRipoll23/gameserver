import { Container } from "@needle-di/core";
import { HTTPService } from "./core/services/http-service.ts";
import { DatabaseService } from "./core/services/database-service.ts";
import { EnvService } from "./core/services/env-service.ts";
import { EventsService } from "./api/versions/v1/services/events-service.ts";
import { GameServerDO } from "./durable-objects/game-server-do.ts";
import { Env } from "./core/types/env-type.ts";

let httpService: HTTPService;
let initPromise: Promise<void> | null = null;

async function initialize(env: Env): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const container = new Container();

    const envService = container.get(EnvService);
    envService.init(env);

    const databaseService = container.get(DatabaseService);
    databaseService.init();

    const eventsService = container.get(EventsService);
    await eventsService.init();

    httpService = container.get(HTTPService);
    await httpService.init();
  })().catch((error) => {
    initPromise = null;
    throw error;
  });

  return initPromise;
}

export { GameServerDO };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    await initialize(env);
    return httpService.app.fetch(request, env, ctx);
  },
};
