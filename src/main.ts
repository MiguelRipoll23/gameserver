import { Container } from "@needle-di/core";
import { HTTPService } from "./core/services/http-service.ts";
import { KVService } from "./core/services/kv-service.ts";
import { NOTIFICATION_EVENT } from "./api/versions/v1/constants/event-constants.ts";

Deno.cron("Test server notification", "*/10 * * * *", () => {
  dispatchEvent(
    new CustomEvent(NOTIFICATION_EVENT, {
      detail: {
        message: `This is a server notification at ${new Date().toISOString()}`,
      },
    })
  );
});

const container = new Container();

const kvService = container.get(KVService);
await kvService.init();

const httpService = container.get(HTTPService);
await httpService.listen();
