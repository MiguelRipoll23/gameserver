import { inject, injectable } from "@needle-di/core";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { GetStatsResponseSchema } from "../../schemas/stats-schemas.ts";
import { ServerStatsService } from "../../services/server-stats-service.ts";
import { ServerResponse } from "../../models/server-response.ts";

@injectable()
export class AuthenticatedStatsRouter {
  private app: OpenAPIHono;

  constructor(private serverStatsService = inject(ServerStatsService)) {
    this.app = new OpenAPIHono();
    this.setRoutes();
  }

  public getRouter(): OpenAPIHono {
    return this.app;
  }

  private setRoutes(): void {
    this.registerGetStatsRoute();
  }

  private registerGetStatsRoute(): void {
    this.app.openapi(
      createRoute({
        method: "get",
        path: "/",
        summary: "Get server stats",
        description: "Obtains the current server stats",
        tags: ["Server stats"],
        responses: {
          200: {
            description: "Responds with data",
            content: {
              "application/json": {
                schema: GetStatsResponseSchema,
              },
            },
          },
          ...ServerResponse.Unauthorized,
        },
      }),
      async (c) => {
        const response = await this.serverStatsService.get();

        return c.json(response, 200);
      }
    );
  }
}
