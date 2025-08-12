import { inject, injectable } from "@needle-di/core";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { UserModerationService } from "../../services/user-moderation-service.ts";
import {
  BanUserRequestSchema,
  UnbanUserRequestSchema,
  GetUserBansResponseSchema,
  GetUserReportsResponseSchema,
  GetUserBansQuerySchema,
  GetUserReportsQuerySchema,
} from "../../schemas/user-moderation-schemas.ts";
import { ServerResponse } from "../../models/server-response.ts";

@injectable()
export class ManagementUserModerationRouter {
  private app: OpenAPIHono;

  constructor(private userModerationService = inject(UserModerationService)) {
    this.app = new OpenAPIHono();
    this.setRoutes();
  }

  public getRouter(): OpenAPIHono {
    return this.app;
  }

  private setRoutes(): void {
    this.registerGetUserReportsRoute();
    this.registerGetUserBansRoute();
    this.registerBanUserRoute();
    this.registerUnbanUserRoute();
  }

  private registerGetUserReportsRoute(): void {
    this.app.openapi(
      createRoute({
        method: "get",
        path: "/reports/:userId",
        summary: "Get user reports",
        description:
          "Retrieves all reports for a specific user with pagination",
        tags: ["User reports"],
        request: {
          params: z.object({
            userId: z
              .string()
              .length(36)
              .describe("The user ID to get reports for"),
          }),
          query: GetUserReportsQuerySchema,
        },
        responses: {
          200: {
            description: "Responds with user reports data",
            content: {
              "application/json": {
                schema: GetUserReportsResponseSchema,
              },
            },
          },
          ...ServerResponse.BadRequest,
          ...ServerResponse.Unauthorized,
          ...ServerResponse.Forbidden,
          ...ServerResponse.NotFound,
        },
      }),
      async (c) => {
        const userId = c.req.param("userId");
        const { cursor, limit } = c.req.valid("query");

        const response = await this.userModerationService.getUserReports({
          userId,
          cursor,
          limit,
        });

        return c.json(response, 200);
      }
    );
  }

  private registerGetUserBansRoute(): void {
    this.app.openapi(
      createRoute({
        method: "get",
        path: "/bans/:userId",
        summary: "Get user bans",
        description: "Retrieves all bans for a specific user with pagination",
        tags: ["User bans"],
        request: {
          params: z.object({
            userId: z
              .string()
              .length(36)
              .describe("The user ID to get bans for"),
          }),
          query: GetUserBansQuerySchema,
        },
        responses: {
          200: {
            description: "Responds with user bans data",
            content: {
              "application/json": {
                schema: GetUserBansResponseSchema,
              },
            },
          },
          ...ServerResponse.BadRequest,
          ...ServerResponse.Unauthorized,
          ...ServerResponse.Forbidden,
          ...ServerResponse.NotFound,
        },
      }),
      async (c) => {
        const userId = c.req.param("userId");
        const { cursor, limit } = c.req.valid("query");

        const response = await this.userModerationService.getUserBans({
          userId,
          cursor,
          limit,
        });

        return c.json(response, 200);
      }
    );
  }

  private registerBanUserRoute(): void {
    this.app.openapi(
      createRoute({
        method: "post",
        path: "/ban",
        summary: "Ban user",
        description: "Temporarily or permanently bans a user",
        tags: ["User bans"],
        request: {
          body: {
            content: {
              "application/json": {
                schema: BanUserRequestSchema,
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
        const validated = c.req.valid("json");
        await this.userModerationService.banUser(validated);
        return c.body(null, 204);
      }
    );
  }

  private registerUnbanUserRoute(): void {
    this.app.openapi(
      createRoute({
        method: "delete",
        path: "/ban/:userId",
        summary: "Unban user",
        description: "Removes the ban for the specified user",
        tags: ["User bans"],
        request: {
          params: UnbanUserRequestSchema,
        },
        responses: {
          ...ServerResponse.NoContent,
          ...ServerResponse.Unauthorized,
          ...ServerResponse.Forbidden,
          ...ServerResponse.NotFound,
        },
      }),
      async (c) => {
        const userId = c.req.param("userId");
        await this.userModerationService.unbanUser(userId);
        return c.body(null, 204);
      }
    );
  }
}
