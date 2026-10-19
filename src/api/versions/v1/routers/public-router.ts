import { OpenAPIHono } from "@hono/zod-openapi";
import { inject, injectable } from "@needle-di/core";
import { PublicRegistrationRouter } from "./public/public-registration-router.ts";
import { PublicVersionRouter } from "./public/public-version-router.ts";
import { PublicAuthenticationRouter } from "./public/public-authentication-router.ts";
import { AuthenticatedWebSocketRouter } from "./public/public-websocket-router.ts";
import { PublicDiscordInteractionsRouter } from "./public/public-discord-interactions-router.ts";

@injectable()
export class V1PublicRouter {
  private app: OpenAPIHono;

  constructor(
    private versionRouter = inject(PublicVersionRouter),
    private registrationRouter = inject(PublicRegistrationRouter),
    private authenticationRouter = inject(PublicAuthenticationRouter),
    private webSocketRouter = inject(AuthenticatedWebSocketRouter),
    private discordRouter = inject(PublicDiscordInteractionsRouter),
  ) {
    this.app = new OpenAPIHono();
    this.setRoutes();
  }

  public getRouter(): OpenAPIHono {
    return this.app;
  }

  private setRoutes(): void {
    this.app.route("/game-version", this.versionRouter.getRouter());
    this.app.route("/registration", this.registrationRouter.getRouter());
    this.app.route("/authentication", this.authenticationRouter.getRouter());
    this.app.route("/websocket", this.webSocketRouter.getRouter());
    this.app.route("/discord", this.discordRouter.getRouter());
  }
}
