import { inject, injectable } from "@needle-di/core";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { UserScoresService } from "../../services/user-scores-service.ts";
import {
  UpdateUserScoreParamsSchema,
  UpdateUserScoreRequestSchema,
} from "../../schemas/scores-schemas.ts";
import { ServerResponse } from "../../models/server-response.ts";

@injectable()
export class ManagementUserScoresRouter {
  private app: OpenAPIHono;

  constructor(private userScoresService = inject(UserScoresService)) {
    this.app = new OpenAPIHono();
    this.setRoutes();
  }

  public getRouter(): OpenAPIHono {
    return this.app;
  }

  private setRoutes(): void {
    this.registerUpdateUserScoreRoute();
  }

  private registerUpdateUserScoreRoute(): void {
    this.app.openapi(
      createRoute({
        method: "put",
        path: "/:userId",
        summary: "Update user score",
        description: "Sets the total score of a user, creating it if it does not exist",
        tags: ["User scores"],
        request: {
          params: UpdateUserScoreParamsSchema,
          body: {
            content: {
              "application/json": {
                schema: UpdateUserScoreRequestSchema,
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
        const userId = c.req.param("userId");
        const { totalScore } = c.req.valid("json");

        await this.userScoresService.updateScore(userId, totalScore);

        return c.body(null, 204);
      },
    );
  }
}
