import { Container } from "@needle-di/core";
import { HTTPService } from "./core/services/http-service.ts";
import { BaseKVService } from "./core/services/kv-service.ts";
import { DatabaseService } from "./core/services/database-service.ts";

const container = new Container();

const databaseService = container.get(DatabaseService);
databaseService.init();

const kvService = container.get(BaseKVService);
await kvService.init();

const httpService = container.get(HTTPService);
await httpService.listen();
