import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { inject, injectable } from "@needle-di/core";
import { AntiCheatDefinitionsService } from "../../services/anti-cheat-definitions-service.ts";
import {
  AntiCheatDefinitionsResponseSchema,
  UpdateAntiCheatDefinitionsRequestSchema,
} from "../../schemas/anti-cheat-definitions-schemas.ts";
import { ServerResponse } from "../../models/server-response.ts";

@injectable()
export class ManagementAntiCheatDefinitionsRouter {
  private app: OpenAPIHono;

  constructor(
    private antiCheatDefinitionsService = inject(AntiCheatDefinitionsService),
  ) {
    this.app = new OpenAPIHono();
    this.setRoutes();
  }

  public getRouter(): OpenAPIHono {
    return this.app;
  }

  private setRoutes(): void {
    this.registerGetDefinitionsRoute();
    this.registerUpdateDefinitionsRoute();
  }

  private registerGetDefinitionsRoute(): void {
    this.app.openapi(
      createRoute({
        method: "get",
        path: "/",
        summary: "Get anti-cheat definitions",
        description:
          "Returns the anti-cheat rule definitions used by the management console to render rule types, fields, events, entities and value types",
        tags: ["Anti-cheat rules"],
        responses: {
          200: {
            description: "Responds with the anti-cheat definitions",
            content: {
              "application/json": {
                schema: AntiCheatDefinitionsResponseSchema,
              },
            },
          },
          ...ServerResponse.Unauthorized,
          ...ServerResponse.Forbidden,
        },
      }),
      async (c) => {
        const response = await this.antiCheatDefinitionsService.get();

        return c.json(response, 200);
      },
    );
  }

  private registerUpdateDefinitionsRoute(): void {
    this.app.openapi(
      createRoute({
        method: "put",
        path: "/",
        summary: "Update anti-cheat definitions",
        description:
          "Replaces the anti-cheat rule definitions used by the management console to render rule types, fields, events, entities and value types",
        tags: ["Anti-cheat rules"],
        request: {
          body: {
            content: {
              "application/json": {
                schema: UpdateAntiCheatDefinitionsRequestSchema,
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

        await this.antiCheatDefinitionsService.set(validated);

        return c.body(null, 204);
      },
    );
  }
}
