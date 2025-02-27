import { OpenAPIHono } from "@hono/zod-openapi";
import { inject, injectable } from "@needle-di/core";
import { HonoVariablesType } from "../../../../core/types/hono-variables-type.ts";
import { AuthenticationMiddleware } from "../../../middlewares/authentication-middleware.ts";
import { AuthenticatedConfigurationRouter } from "./authenticated/authenticated-configuration-route.ts";
import { AuthenticatedWebSocketRouter } from "./authenticated/authenticated-websocket-router.ts";
import { AuthenticatedMessagesRouter } from "./authenticated/authenticated-messages-router.ts";
import { AuthenticatedMatchesRouter } from "./authenticated/authenticated-matches-router.ts";
import { AuthenticatedScoresRouter } from "./authenticated/authenticated-scores-router.ts";

@injectable()
export class V1AuthenticatedRouter {
  private app: OpenAPIHono<{ Variables: HonoVariablesType }>;

  constructor(
    private authenticationMiddleware = inject(AuthenticationMiddleware),
    private configurationRouter = inject(AuthenticatedConfigurationRouter),
    private webSocketRouter = inject(AuthenticatedWebSocketRouter),
    private messagesRouter = inject(AuthenticatedMessagesRouter),
    private matchesRouter = inject(AuthenticatedMatchesRouter),
    private scoresRouter = inject(AuthenticatedScoresRouter),
  ) {
    this.app = new OpenAPIHono();
    this.setMiddlewares();
    this.setRoutes();
  }

  public getRouter(): OpenAPIHono<{ Variables: HonoVariablesType }> {
    return this.app;
  }

  private setMiddlewares(): void {
    this.setAuthenticationMiddleware();
  }

  private setAuthenticationMiddleware(): void {
    this.app.use("*", this.authenticationMiddleware.create());
  }

  private setRoutes(): void {
    this.app.route("/game-configuration", this.configurationRouter.getRouter());
    this.app.route("/websocket", this.webSocketRouter.getRouter());
    this.app.route("/server-messages", this.messagesRouter.getRouter());
    this.app.route("/matches", this.matchesRouter.getRouter());
    this.app.route("/player-scores", this.scoresRouter.getRouter());
  }
}
