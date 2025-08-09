import { inject, injectable } from "@needle-di/core";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { UserScoresService } from "../../services/scores-service.ts";
import { HonoVariablesType } from "../../../../../core/types/hono-variables-type.ts";
import { GetScoresResponseSchema } from "../../schemas/scores-schemas.ts";
import { ServerResponse } from "../../models/server-response.ts";

@injectable()
export class AuthenticatedUserScoresRouter {
  private app: OpenAPIHono<{ Variables: HonoVariablesType }>;

  constructor(private scoresService = inject(UserScoresService)) {
    this.app = new OpenAPIHono();
    this.setRoutes();
  }

  public getRouter(): OpenAPIHono<{ Variables: HonoVariablesType }> {
    return this.app;
  }

  private setRoutes(): void {
    this.registerGetScoresRoute();
    this.registerSaveScoreRoute();
  }

  private registerGetScoresRoute(): void {
    this.app.openapi(
      createRoute({
        method: "get",
        path: "/",
        summary: "Get user scores",
        description: "Obtains list of saved user scores",
        tags: ["User scores"],
        responses: {
          200: {
            description: "Responds with data",
            content: {
              "application/json": {
                schema: GetScoresResponseSchema,
              },
            },
          },
          ...ServerResponse.Unauthorized,
        },
      }),
      async (c) => {
        const response = await this.scoresService.list();

        return c.json(response, 200);
      }
    );
  }

  private registerSaveScoreRoute(): void {
    this.app.openapi(
      createRoute({
        method: "post",
        path: "/",
        summary: "Save user score",
        description: "Updates the user score using an encrypted payload",
        tags: ["User scores"],
        request: {
          body: {
            content: {
              "octet/stream": {
                schema: {
                  type: "string",
                  format: "binary",
                },
              },
            },
          },
        },
        responses: {
          ...ServerResponse.NoContent,
          ...ServerResponse.BadRequest,
          ...ServerResponse.Unauthorized,
        },
      }),
      async (c) => {
        const userId = c.get("userId");
        const validated = await c.req.arrayBuffer();
        await this.scoresService.save(userId, validated);

        return c.body(null, 204);
      }
    );
  }
}
