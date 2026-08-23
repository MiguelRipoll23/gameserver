import { inject, injectable } from "@needle-di/core";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { AntiCheatRulesService } from "../../services/anti-cheat-rules-service.ts";
import { ConfigurationService } from "../../services/configuration-service.ts";
import {
  AntiCheatRuleParamsSchema,
  CreateAntiCheatRuleRequestSchema,
  GetAntiCheatRulesQuerySchema,
  GetAntiCheatRulesResponseSchema,
  UpdateAntiCheatRuleRequestSchema,
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
    this.registerCreateAntiCheatRuleRoute();
    this.registerUpdateAntiCheatRuleRoute();
    this.registerDeleteAntiCheatRuleRoute();
  }

  private registerGetAntiCheatRulesRoute(): void {
    this.app.openapi(
      createRoute({
        method: "get",
        path: "/",
        summary: "Get anti-cheat rules",
        description:
          "Obtains paginated anti-cheat rules, optionally filtered by rule type",
        tags: ["Anti-cheat rules"],
        request: {
          query: GetAntiCheatRulesQuerySchema,
        },
        responses: {
          200: {
            description: "Responds with the paginated anti-cheat rules",
            content: {
              "application/json": {
                schema: GetAntiCheatRulesResponseSchema,
              },
            },
          },
          ...ServerResponse.BadRequest,
          ...ServerResponse.Unauthorized,
          ...ServerResponse.Forbidden,
        },
      }),
      async (c) => {
        const query = c.req.valid("query");
        const response = await this.antiCheatRulesService.list(query);

        return c.json(response, 200);
      },
    );
  }

  private registerCreateAntiCheatRuleRoute(): void {
    this.app.openapi(
      createRoute({
        method: "post",
        path: "/",
        summary: "Create anti-cheat rule",
        description:
          "Creates a single anti-cheat rule, updates the game configuration and pushes it to connected clients",
        tags: ["Anti-cheat rules"],
        request: {
          body: {
            content: {
              "application/json": {
                schema: CreateAntiCheatRuleRequestSchema,
              },
            },
          },
        },
        responses: {
          ...ServerResponse.NoContent,
          ...ServerResponse.BadRequest,
          ...ServerResponse.Unauthorized,
          ...ServerResponse.Forbidden,
          ...ServerResponse.Conflict,
        },
      }),
      async (c) => {
        const validated = c.req.valid("json");

        await this.antiCheatRulesService.createRule(validated);
        await this.syncConfiguration();

        return c.body(null, 204);
      },
    );
  }

  private registerUpdateAntiCheatRuleRoute(): void {
    this.app.openapi(
      createRoute({
        method: "put",
        path: "/:ruleId",
        summary: "Update anti-cheat rule",
        description:
          "Replaces the content of an anti-cheat rule, updates the game configuration and pushes it to connected clients",
        tags: ["Anti-cheat rules"],
        request: {
          params: AntiCheatRuleParamsSchema,
          body: {
            content: {
              "application/json": {
                schema: UpdateAntiCheatRuleRequestSchema,
              },
            },
          },
        },
        responses: {
          ...ServerResponse.NoContent,
          ...ServerResponse.BadRequest,
          ...ServerResponse.Unauthorized,
          ...ServerResponse.Forbidden,
          ...ServerResponse.NotFound,
        },
      }),
      async (c) => {
        const { ruleId } = c.req.valid("param");
        const validated = c.req.valid("json");

        await this.antiCheatRulesService.updateRule(ruleId, validated);
        await this.syncConfiguration();

        return c.body(null, 204);
      },
    );
  }

  private registerDeleteAntiCheatRuleRoute(): void {
    this.app.openapi(
      createRoute({
        method: "delete",
        path: "/:ruleId",
        summary: "Delete anti-cheat rule",
        description:
          "Deletes an anti-cheat rule, updates the game configuration and pushes it to connected clients",
        tags: ["Anti-cheat rules"],
        request: {
          params: AntiCheatRuleParamsSchema,
        },
        responses: {
          ...ServerResponse.NoContent,
          ...ServerResponse.BadRequest,
          ...ServerResponse.Unauthorized,
          ...ServerResponse.Forbidden,
          ...ServerResponse.NotFound,
        },
      }),
      async (c) => {
        const { ruleId } = c.req.valid("param");

        await this.antiCheatRulesService.deleteRule(ruleId);
        await this.syncConfiguration();

        return c.body(null, 204);
      },
    );
  }

  /**
   * Re-serializes the full rule set into the game configuration and pushes it
   * to every connected client, keeping them in sync with the stored rules.
   */
  private async syncConfiguration(): Promise<void> {
    const rules = await this.antiCheatRulesService.getAllRules();
    await this.configurationService.updateAntiCheatRules(rules);
  }
}
