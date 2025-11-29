import { inject, injectable } from "@needle-di/core";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { UserScoresService } from "../../services/user-scores-service.ts";
import { HonoVariables } from "../../../../../core/types/hono-variables-type.ts";
import {
  GetScoresResponseSchema,
  GetScoresQuerySchema,
} from "../../schemas/scores-schemas.ts";
import { ServerResponse } from "../../models/server-response.ts";

@injectable()
export class AuthenticatedUserScoresRouter {
  private app: OpenAPIHono<{ Variables: HonoVariables }>;

  constructor(private userScoresService = inject(UserScoresService)) {
    this.app = new OpenAPIHono();
    this.setRoutes();
  }

  public getRouter(): OpenAPIHono<{ Variables: HonoVariables }> {
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
        description: "Obtains paginated list of saved user scores",
        tags: ["User scores"],
        request: {
          query: GetScoresQuerySchema,
        },
        responses: {
          200: {
            description: "Responds with paginated data",
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
        const query = c.req.valid("query");
        const response = await this.userScoresService.list(query);

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
        await this.userScoresService.save(userId, validated);

        return c.body(null, 204);
      }
    );
  }
}
