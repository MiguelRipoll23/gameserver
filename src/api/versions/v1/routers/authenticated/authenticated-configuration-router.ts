import { inject, injectable } from "@needle-di/core";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { ConfigurationService } from "../../services/configuration-service.ts";
import { HonoVariablesType } from "../../../../../core/types/hono-variables-type.ts";
import { ServerResponse } from "../../models/server-response.ts";

@injectable()
export class AuthenticatedConfigurationRouter {
  private app: OpenAPIHono<{ Variables: HonoVariablesType }>;

  constructor(private configurationService = inject(ConfigurationService)) {
    this.app = new OpenAPIHono();
    this.setRoutes();
  }

  public getRouter(): OpenAPIHono<{ Variables: HonoVariablesType }> {
    return this.app;
  }

  private setRoutes(): void {
    this.registerGetConfigurationBlobRoute();
  }

  private registerGetConfigurationBlobRoute(): void {
    this.app.openapi(
      createRoute({
        method: "get",
        path: "/encrypted",
        summary: "Get encrypted game configuration",
        description:
          "Obtains encrypted game configuration to be applied by the client",
        tags: ["Game configuration"],
        responses: {
          200: {
            description: "Responds with data",
            content: {
              "octet/stream": {
                schema: {
                  type: "string",
                  format: "binary",
                },
              },
            },
          },
          ...ServerResponse.Unauthorized,
          ...ServerResponse.BadRequest,
          ...ServerResponse.NotFound,
        },
      }),
      async (c) => {
        const userId = c.get("userId");
        const response = await this.configurationService.getBlob(userId);

        return c.body(response, 200, {
          "Content-Type": "octet/stream",
        });
      },
    );
  }
}
