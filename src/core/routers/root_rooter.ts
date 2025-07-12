import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { injectable } from "@needle-di/core";
import { GameUtils } from "../utils/game-utils.ts";

@injectable()
export class RootRouter {
  private app: OpenAPIHono;

  constructor() {
    this.app = new OpenAPIHono();
    this.setRoutes();
  }

  public getRouter(): OpenAPIHono {
    return this.app;
  }

  private setRoutes(): void {
    this.registerHealthRoute();
    this.registerPlayGameRoute();
  }

  private registerHealthRoute(): void {
    this.app.openapi(
      createRoute({
        method: "get",
        path: "/health",
        summary: "Get health",
        description: "Obtains health related to this server",
        tags: ["Root"],
        responses: {
          204: {
            description: "Responds with no content",
          },
        },
      }),
      (c) => {
        return c.body(null, 204);
      },
    );
  }

  private registerPlayGameRoute(): void {
    this.app.openapi(
      createRoute({
        method: "get",
        path: "/game",
        summary: "Get game",
        description: "Obtains game associated with this server",
        tags: ["Root"],
        responses: {
          307: {
            description: "Responds with temporary redirect",
          },
        },
      }),
      (c) => {
        return c.redirect(GameUtils.getURL(), 307);
      },
    );
  }
}
