import { inject, injectable } from "@needle-di/core";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { GetStatsResponseSchema } from "../../schemas/stats-schemas.ts";
import { StatsService } from "../../services/stats-service.ts";
import { ServerResponse } from "../../models/server-response.ts";

@injectable()
export class AuthenticatedStatsRouter {
  private app: OpenAPIHono;

  constructor(private statsService = inject(StatsService)) {
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
      (c) => {
        const response = this.statsService.get();

        return c.json(response, 200);
      }
    );
  }
}
