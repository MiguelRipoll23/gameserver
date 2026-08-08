import { inject, injectable } from "@needle-di/core";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { AntiCheatRulesService } from "../../services/anti-cheat-rules-service.ts";
import { ConfigurationService } from "../../services/configuration-service.ts";
import {
  GetAntiCheatRulesResponseSchema,
  UpdateAntiCheatRulesRequestSchema,
} from "../../schemas/anti-cheat-rules-schemas.ts";
import { ServerResponse } from "../../models/server-response.ts";

@injectable()
export class ManagementAntiCheatRulesRouter {
  private app: OpenAPIHono;

  constructor(
    private antiCheatRulesService = inject(AntiCheatRulesService),
    private configurationService = inject(ConfigurationService),
  ) {
    this.app = new OpenAPIHono();
    this.setRoutes();
  }

  public getRouter(): OpenAPIHono {
    return this.app;
  }

  private setRoutes(): void {
    this.registerGetAntiCheatRulesRoute();
    this.registerUpdateAntiCheatRulesRoute();
  }

  private registerGetAntiCheatRulesRoute(): void {
    this.app.openapi(
      createRoute({
        method: "get",
        path: "/",
        summary: "Get anti-cheat rules",
        description: "Obtains the configured anti-cheat rules",
        tags: ["Anti-cheat rules"],
        responses: {
          200: {
            description: "Responds with the anti-cheat rules",
            content: {
              "application/json": {
                schema: GetAntiCheatRulesResponseSchema,
              },
            },
          },
          ...ServerResponse.Unauthorized,
          ...ServerResponse.Forbidden,
        },
      }),
      async (c) => {
        const rules = await this.antiCheatRulesService.getRules();

        return c.json({ rules }, 200);
      },
    );
  }

  private registerUpdateAntiCheatRulesRoute(): void {
    this.app.openapi(
      createRoute({
        method: "post",
        path: "/",
        summary: "Update anti-cheat rules",
        description:
          "Replaces the anti-cheat rules, updates the game configuration and pushes them to connected clients",
        tags: ["Anti-cheat rules"],
        request: {
          body: {
            content: {
              "application/json": {
                schema: UpdateAntiCheatRulesRequestSchema,
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

        await this.antiCheatRulesService.replaceRules(validated.rules);
        await this.configurationService.updateAntiCheatRules(validated.rules);

        return c.body(null, 204);
      },
    );
  }
}
