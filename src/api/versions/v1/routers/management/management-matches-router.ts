import { inject, injectable } from "@needle-di/core";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { MatchesService } from "../../services/matches-service.ts";
import { ServerResponse } from "../../models/server-response.ts";

@injectable()
export class ManagementMatchesRouter {
  private app: OpenAPIHono;

  constructor(private matchesService = inject(MatchesService)) {
    this.app = new OpenAPIHono();
    this.setRoutes();
  }

  public getRouter(): OpenAPIHono {
    return this.app;
  }

  private setRoutes(): void {
    this.registerDeleteMatchRoute();
  }

  private registerDeleteMatchRoute(): void {
    this.app.openapi(
      createRoute({
        method: "delete",
        path: "/:matchId",
        summary: "Delete match",
        description: "Deletes a match by its ID",
        tags: ["Matches"],
        request: {
          params: z.object({
            matchId: z.coerce
              .number()
              .int()
              .positive()
              .describe("The ID of the match to delete"),
          }),
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
        const { matchId } = c.req.valid("param");
        await this.matchesService.deleteById(matchId);

        return c.body(null, 204);
      },
    );
  }
}
