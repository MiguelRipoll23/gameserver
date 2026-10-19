import { OpenAPIHono } from "@hono/zod-openapi";
import { inject, injectable } from "@needle-di/core";
import { HonoVariables } from "../../../../core/types/hono-variables-type.ts";
import { AuthenticationMiddleware } from "../../../middlewares/authentication-middleware.ts";
import { AuthenticatedConfigurationRouter } from "./authenticated/authenticated-configuration-router.ts";
import { AuthenticatedServerMessagesRouter } from "./authenticated/authenticated-server-messages-router.ts";
import { AuthenticatedMatchesRouter } from "./authenticated/authenticated-matches-router.ts";
import { AuthenticatedUserScoresRouter } from "./authenticated/authenticated-user-scores-router.ts";
import { AuthenticatedUserModerationRouter } from "./authenticated/authenticated-user-moderation-router.ts";
import { AuthenticatedBanStatusRouter } from "./authenticated/authenticated-ban-status-router.ts";

/**
 * Routes available to signed-in players and game clients.
 *
 * Moderation endpoints that review reports or manage bans were moved to the
 * `gameserver-console` backend; players can still file reports and read their
 * own ban status here.
 */
@injectable()
export class V1AuthenticatedRouter {
  private app: OpenAPIHono<{ Variables: HonoVariables }>;

  constructor(
    private authenticationMiddleware = inject(AuthenticationMiddleware),
    private configurationRouter = inject(AuthenticatedConfigurationRouter),
    private serverMessagesRouter = inject(AuthenticatedServerMessagesRouter),
    private matchesRouter = inject(AuthenticatedMatchesRouter),
    private userScoresRouter = inject(AuthenticatedUserScoresRouter),
    private userModerationRouter = inject(AuthenticatedUserModerationRouter),
    private banStatusRouter = inject(AuthenticatedBanStatusRouter),
  ) {
    this.app = new OpenAPIHono();
    this.setMiddlewares();
    this.setRoutes();
  }

  public getRouter(): OpenAPIHono<{ Variables: HonoVariables }> {
    return this.app;
  }

  private setMiddlewares(): void {
    this.setAuthenticationMiddleware();
  }

  private setAuthenticationMiddleware(): void {
    this.app.use("*", ...this.authenticationMiddleware.create());
  }

  private setRoutes(): void {
    this.app.route("/game-configuration", this.configurationRouter.getRouter());
    this.app.route("/server-messages", this.serverMessagesRouter.getRouter());
    this.app.route("/matches", this.matchesRouter.getRouter());
    this.app.route("/user-scores", this.userScoresRouter.getRouter());
    this.app.route("/user-moderation", this.userModerationRouter.getRouter());
    this.app.route("/user-bans", this.banStatusRouter.getRouter());
  }
}
