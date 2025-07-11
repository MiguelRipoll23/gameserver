import { Container } from "@needle-di/core";
import { HTTPService } from "./core/services/http-service.ts";
import { KVService } from "./core/services/kv-service.ts";

const container = new Container();

const kvService = container.get(KVService);
await kvService.init();

const httpService = container.get(HTTPService);
httpService.listen();
