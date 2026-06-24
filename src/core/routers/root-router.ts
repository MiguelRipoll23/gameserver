import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { inject, injectable } from "@needle-di/core";
import { EnvService } from "../services/env-service.ts";
import { GameUtils } from "../utils/game-utils.ts";

@injectable()
export class RootRouter {
  private app: OpenAPIHono;

  constructor(private envService = inject(EnvService)) {
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
        tags: ["Default"],
        responses: {
          204: {
            description: "Responds with no content",
          },
        },
      }),
      (c) => {
        return c.body(null, 204);
      }
    );
  }

  private registerPlayGameRoute(): void {
    this.app.openapi(
      createRoute({
        method: "get",
        path: "/game",
        summary: "Get game",
        description: "Obtains game associated with this server",
        tags: ["Default"],
        responses: {
          307: {
            description: "Responds with temporary redirect",
          },
        },
      }),
      (c) => {
        const gameUrl = this.envService.get("GAME_URL") || undefined;
        return c.redirect(GameUtils.getURL(gameUrl), 307);
      }
    );
  }
}
