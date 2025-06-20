import { inject, injectable } from "@needle-di/core";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { ScoresService } from "../../services/scores-service.ts";
import { HonoVariablesType } from "../../../../../core/types/hono-variables-type.ts";
import { GetScoresResponseSchema } from "../../schemas/scores-schemas.ts";
import { ServerResponse } from "../../models/server-response.ts";

@injectable()
export class AuthenticatedScoresRouter {
  private app: OpenAPIHono<{ Variables: HonoVariablesType }>;

  constructor(private scoresService = inject(ScoresService)) {
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
        summary: "Get player scores",
        description: "Obtains list of saved player scores",
        tags: ["Player scores"],
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
        summary: "Save player score",
        description: "Updates the player score using an encrypted payload",
        tags: ["Player scores"],
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
