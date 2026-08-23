import { inject, injectable } from "@needle-di/core";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { VersionService } from "../../services/version-service.ts";
import { UpdateVersionRequestSchema } from "../../schemas/version-schemas.ts";
import { ServerResponse } from "../../models/server-response.ts";

@injectable()
export class PublicVersionRouter {
  private app: OpenAPIHono;

  constructor(private versionService = inject(VersionService)) {
    this.app = new OpenAPIHono();
    this.setRoutes();
  }

  public getRouter(): OpenAPIHono {
    return this.app;
  }

  private setRoutes(): void {
    this.registerGetVersionInformationRoute();
  }

  private registerGetVersionInformationRoute(): void {
    this.app.openapi(
      createRoute({
        method: "get",
        path: "/",
        summary: "Get game version",
        description: "Obtains general version information related to the game",
        tags: ["Game version"],
        security: [],
        responses: {
          200: {
            description: "Responds with data",
            content: {
              "application/json": {
                schema: UpdateVersionRequestSchema,
              },
            },
          },
          ...ServerResponse.NotFound,
        },
      }),
      async (c) => {
        const response = await this.versionService.get();

        return c.json(response, 200);
      },
    );
  }
}
