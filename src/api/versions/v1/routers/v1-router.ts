import { OpenAPIHono } from "@hono/zod-openapi";
import { V1PublicRouter } from "./public-router.ts";
import { V1AuthenticatedRouter } from "./authenticated-router.ts";
import { inject, injectable } from "@needle-di/core";

/**
 * Game-client API surface.
 *
 * Management and moderation endpoints live in the separate
 * `gameserver-console` backend; this Worker only serves what game clients
 * need (including reporting other players and reading their own ban status).
 */
@injectable()
export class V1Router {
  private app: OpenAPIHono;

  constructor(
    private publicRouter = inject(V1PublicRouter),
    private authenticatedRouter = inject(V1AuthenticatedRouter),
  ) {
    this.app = new OpenAPIHono();
    this.setRoutes();
  }

  public getRouter(): OpenAPIHono {
    return this.app;
  }

  private setRoutes(): void {
    this.app.route("/", this.publicRouter.getRouter());
    this.app.route("/", this.authenticatedRouter.getRouter());
  }
}
