import { logger } from "hono/logger";
import { bodyLimit } from "hono/body-limit";
import { serveStatic } from "hono/deno";
import { OpenAPIHono } from "@hono/zod-openapi";
import { inject, injectable } from "@needle-di/core";
import { OpenAPIService } from "./openapi-service.ts";
import { APIRouter } from "../../api/routers/api-router.ts";
import { RootRouter } from "../routers/root_rooter.ts";
import { ErrorHandlingService } from "./error-handling-service.ts";
import { HonoVariablesType } from "../types/hono-variables-type.ts";
import { CORSMiddleware } from "../middlewares/cors-middleware.ts";
import { ServerError } from "../../api/versions/v1/models/server-error.ts";
import { RateLimiterMiddleware } from "../middlewares/rate-limiter-middleware.ts";
import { KVService } from "./kv-service.ts";

@injectable()
export class HTTPService {
  private app: OpenAPIHono<{ Variables: HonoVariablesType }>;

  constructor(
    private kvService = inject(KVService),
    private rootRooter = inject(RootRouter),
    private apiRouter = inject(APIRouter)
  ) {
    this.app = new OpenAPIHono();
    this.configure();
    this.setMiddlewares();
    this.setRoutes();
  }

  public listen(): void {
    Deno.serve(this.app.fetch);
  }

  private configure(): void {
    ErrorHandlingService.configure(this.app);
    OpenAPIService.configure(this.app);
  }

  private setMiddlewares(): void {
    this.app.use("*", logger());
    this.app.use("*", RateLimiterMiddleware.create(this.kvService));
    this.app.use("*", CORSMiddleware.create());
    this.app.use("*", serveStatic({ root: "./static" }));
    this.setBodyLimitMiddleware();
  }

  private setBodyLimitMiddleware(): void {
    this.app.use(
      "*",
      bodyLimit({
        maxSize: 1024 * 1024,
        onError: () => {
          throw new ServerError(
            "BODY_SIZE_LIMIT_EXCEEDED",
            "Request body size limit exceeded",
            413
          );
        },
      })
    );
  }

  private setRoutes(): void {
    this.app.route("/", this.rootRooter.getRouter());
    this.app.route("/api", this.apiRouter.getRouter());

    OpenAPIService.setRoutes(this.app);
  }
}
