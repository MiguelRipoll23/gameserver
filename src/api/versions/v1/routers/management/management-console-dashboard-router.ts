import { inject, injectable } from "@needle-di/core";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { ConsoleDashboardService } from "../../services/console-dashboard-service.ts";
import { GetConsoleDashboardResponseSchema } from "../../schemas/console-dashboard-schemas.ts";
import { ServerResponse } from "../../models/server-response.ts";

@injectable()
export class ManagementConsoleDashboardRouter {
  private app: OpenAPIHono;

  constructor(
    private consoleDashboardService = inject(ConsoleDashboardService),
  ) {
    this.app = new OpenAPIHono();
    this.setRoutes();
  }

  public getRouter(): OpenAPIHono {
    return this.app;
  }

  private setRoutes(): void {
    this.registerGetDashboardRoute();
  }

  private registerGetDashboardRoute(): void {
    this.app.openapi(
      createRoute({
        method: "get",
        path: "/",
        summary: "Get dashboard data",
        description:
          "Retrieves all data displayed on the management console dashboard",
        tags: ["Console"],
        responses: {
          200: {
            description: "Responds with console dashboard data",
            content: {
              "application/json": {
                schema: GetConsoleDashboardResponseSchema,
              },
            },
          },
          ...ServerResponse.Unauthorized,
          ...ServerResponse.Forbidden,
        },
      }),
      async (c) => {
        const response = await this.consoleDashboardService.get();

        return c.json(response, 200);
      },
    );
  }
}
