import { inject, injectable } from "@needle-di/core";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { VersionService } from "../../services/version-service.ts";
import { UpdateVersionRequestSchema } from "../../schemas/version-schemas.ts";
import { ServerResponse } from "../../models/server-response.ts";

@injectable()
export class ManagementVersionRouter {
  private app: OpenAPIHono;

  constructor(private versionService = inject(VersionService)) {
    this.app = new OpenAPIHono();
    this.setRoutes();
  }

  public getRouter(): OpenAPIHono {
    return this.app;
  }

  private setRoutes(): void {
    this.registerSetVersionInformationRoute();
  }

  private registerSetVersionInformationRoute(): void {
    this.app.openapi(
      createRoute({
        method: "post",
        path: "/",
        summary: "Set game version",
        description: "Updates general version information related to the game",
        tags: ["Game version"],
        request: {
          body: {
            content: {
              "application/json": {
                schema: UpdateVersionRequestSchema,
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
        await this.versionService.set(validated);

        return c.body(null, 204);
      },
    );
  }
}
