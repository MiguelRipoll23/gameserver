import { inject, injectable } from "@needle-di/core";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { MatchesService } from "../../services/matches-service.ts";
import { GetMatchesResponseSchema } from "../../schemas/matches-schemas.ts";
import { PaginationSchema } from "../../schemas/pagination-schemas.ts";
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
    this.registerGetMatchesRoute();
    this.registerDeleteMatchRoute();
  }


  private registerGetMatchesRoute(): void {
    this.app.openapi(
      createRoute({
        method: "get",
        path: "/",
        summary: "Get matches",
        description: "Retrieves all matches with pagination",
        tags: ["Matches"],
        request: {
          query: PaginationSchema,
        },
        responses: {
          200: {
            description: "Responds with matches data",
            content: {
              "application/json": {
                schema: GetMatchesResponseSchema,
              },
            },
          },
          ...ServerResponse.BadRequest,
          ...ServerResponse.Unauthorized,
          ...ServerResponse.Forbidden,
        },
      }),
      async (c) => {
        const { cursor, limit } = c.req.valid("query");

        const response = await this.matchesService.list({ cursor, limit });

        return c.json(response, 200);
      },
    );
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
