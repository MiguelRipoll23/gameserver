import { inject, injectable } from "@needle-di/core";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { ConfigurationService } from "../../services/configuration-service.ts";
import {
  GetConfigurationResponseSchema,
  UpdateConfigurationRequestSchema,
} from "../../schemas/configuration-schemas.ts";
import { ServerResponse } from "../../models/server-response.ts";

@injectable()
export class ManagementConfigurationRouter {
  private app: OpenAPIHono;

  constructor(private configurationService = inject(ConfigurationService)) {
    this.app = new OpenAPIHono();
    this.setRoutes();
  }

  public getRouter(): OpenAPIHono {
    return this.app;
  }

  private setRoutes(): void {
    this.registerGetConfigurationDataRoute();
    this.registerSetConfigurationDataRoute();
  }

  private registerGetConfigurationDataRoute(): void {
    this.app.openapi(
      createRoute({
        method: "get",
        path: "/",
        summary: "Get game configuration",
        description: "Obtains cloud configuration data related to the game",
        tags: ["Game configuration"],
        responses: {
          200: {
            description: "Responds with data",
            content: {
              "application/json": {
                schema: GetConfigurationResponseSchema,
              },
            },
          },
          ...ServerResponse.NotFound,
          ...ServerResponse.Unauthorized,
          ...ServerResponse.Forbidden,
        },
      }),
      async (c) => {
        const response = await this.configurationService.getData();

        return c.json(response, 200);
      }
    );
  }

  private registerSetConfigurationDataRoute(): void {
    this.app.openapi(
      createRoute({
        method: "patch",
        path: "/",
        summary: "Set game configuration",
        description: "Updates cloud configuration data related to the game",
        tags: ["Game configuration"],
        request: {
          body: {
            content: {
              "application/json": {
                schema: UpdateConfigurationRequestSchema,
              },
            },
          },
        },
        responses: {
          ...ServerResponse.NoContent,
          ...ServerResponse.BadRequest,
          ...ServerResponse.Unauthorized,
          ...ServerResponse.Forbidden,
        },
      }),
      async (c) => {
        const validated = c.req.valid("json");
        await this.configurationService.setData(validated);

        return c.body(null, 204);
      }
    );
  }
}
