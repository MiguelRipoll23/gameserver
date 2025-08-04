import { inject, injectable } from "@needle-di/core";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { MatchesService } from "../../services/matches-service.ts";
import {
  AdvertiseMatchRequestSchema,
  FindMatchesRequestSchema,
  FindMatchesResponseSchema,
} from "../../schemas/matches-schemas.ts";
import { HonoVariablesType } from "../../../../../core/types/hono-variables-type.ts";
import { ServerResponse } from "../../models/server-response.ts";

@injectable()
export class AuthenticatedMatchesRouter {
  private app: OpenAPIHono<{ Variables: HonoVariablesType }>;

  constructor(private matchesService = inject(MatchesService)) {
    this.app = new OpenAPIHono();
    this.setRoutes();
  }

  public getRouter(): OpenAPIHono<{ Variables: HonoVariablesType }> {
    return this.app;
  }

  private setRoutes(): void {
    this.registerAdvertiseMatchRoute();
    this.registerFindMatchesRoute();
    this.registerDeleteMatchRoute();
  }

  private registerAdvertiseMatchRoute(): void {
    this.app.openapi(
      createRoute({
        method: "post",
        path: "/advertise",
        summary: "Advertise match",
        description: "Advertises a match for other players to join",
        tags: ["Matches"],
        request: {
          body: {
            content: {
              "application/json": {
                schema: AdvertiseMatchRequestSchema,
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
        const validated = c.req.valid("json");
        await this.matchesService.advertise(userId, validated);

        return c.body(null, 204);
      }
    );
  }

  private registerFindMatchesRoute(): void {
    this.app.openapi(
      createRoute({
        method: "post",
        path: "/find",
        summary: "Find matches",
        description: "Obtains available matches to join for the player",
        tags: ["Matches"],
        request: {
          body: {
            content: {
              "application/json": {
                schema: FindMatchesRequestSchema,
              },
            },
          },
        },
        responses: {
          200: {
            description: "Responds with data",
            content: {
              "application/json": {
                schema: FindMatchesResponseSchema,
              },
            },
          },
          ...ServerResponse.Unauthorized,
        },
      }),
      async (c) => {
        const validated = c.req.valid("json");
        console.log(
          "Find matches request validated:",
          JSON.stringify(validated, null, 2)
        );

        const response = await this.matchesService.find(validated);
        console.log(
          "Find matches service response:",
          JSON.stringify(response, null, 2)
        );

        return c.json(response, 200);
      }
    );
  }

  private registerDeleteMatchRoute(): void {
    this.app.openapi(
      createRoute({
        method: "delete",
        path: "/owned",
        summary: "Delete match",
        description: "Deletes the match that the player is currently hosting",
        tags: ["Matches"],
        responses: {
          ...ServerResponse.NoContent,
          ...ServerResponse.Unauthorized,
        },
      }),
      async (c) => {
        const userId = c.get("userId");
        await this.matchesService.delete(userId);

        return c.body(null, 204);
      }
    );
  }
}
