import { logger } from "hono/logger";
import { HTTPException } from "hono/http-exception";
import { bodyLimit } from "hono/body-limit";
import { OpenAPIHono } from "@hono/zod-openapi";
import { inject, injectable } from "@needle-di/core";
import { OpenAPIService } from "./openapi-service.ts";
import { WebAuthnService } from "./webauthn-service.ts";
import { APIRouter } from "../../api/routers/api-router.ts";
import { RootRouter } from "../routers/root-router.ts";
import { ErrorHandlingService } from "./error-handling-service.ts";
import { HonoVariables } from "../types/hono-variables-type.ts";
import { ServerError } from "../../api/versions/v1/models/server-error.ts";
import { Logger } from "../utils/logger.ts";
import { DatabaseService } from "./database-service.ts";

@injectable()
export class HTTPService {
  public readonly app: OpenAPIHono<{ Variables: HonoVariables }>;

  constructor(
    private rootRooter = inject(RootRouter),
    private apiRouter = inject(APIRouter),
    private databaseService = inject(DatabaseService),
  ) {
    this.app = new OpenAPIHono<{ Variables: HonoVariables }>({
      // Route validation failures through onError so they are logged with the
      // original zod error as the cause instead of being returned silently.
      defaultHook: (result) => {
        if (!result.success) {
          const issues = (
            result.error as { issues?: { message?: string }[] } | undefined
          )?.issues;
          const summary =
            issues && issues.length > 0
              ? issues.map((i) => i.message).join("; ")
              : "Bad Request";

          throw new HTTPException(400, {
            message: `Validation failed: ${summary}`,
            cause: result.error,
          });
        }
      },
    });
    this.configure();
    this.setMiddlewares();
    this.setRoutes();
  }

  /**
   * Handles an incoming request against the configured Hono app.
   * Static files are served by the Cloudflare Static Assets feature, so no
   * runtime static file middleware is needed here.
   */
  public async fetch(request: Request): Promise<Response> {
    return await this.databaseService.withConnection(async () =>
      this.app.fetch(request)
    );
  }

  private configure(): void {
    ErrorHandlingService.configure(this.app);
    OpenAPIService.configure(this.app);
    WebAuthnService.configure(this.app);
  }

  private setMiddlewares(): void {
    this.app.use(
      "*",
      logger((message, ...rest) => Logger.log(message, ...rest)),
    );
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
            413,
          );
        },
      }),
    );
  }

  private setRoutes(): void {
    this.app.route("/", this.rootRooter.getRouter());
    this.app.route("/api", this.apiRouter.getRouter());

    OpenAPIService.setRoutes(this.app);
  }
}