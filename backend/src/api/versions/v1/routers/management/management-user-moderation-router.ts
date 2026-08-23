import { inject, injectable } from "@needle-di/core";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { UserModerationService } from "../../services/user-moderation-service.ts";
import {
  BanUserRequestSchema,
  GetUserBansQuerySchema,
  GetUserBansResponseSchema,
  GetUserReportsAutomaticQuerySchema,
  GetUserReportsAutomaticResponseSchema,
  GetUserReportsManualQuerySchema,
  GetUserReportsManualResponseSchema,
  UnbanUserRequestSchema,
} from "../../schemas/user-moderation-schemas.ts";
import { ServerResponse } from "../../models/server-response.ts";
import { HonoVariables } from "../../../../../core/types/hono-variables-type.ts";

@injectable()
export class ManagementUserModerationRouter {
  private app: OpenAPIHono<{ Variables: HonoVariables }>;

  constructor(
    private userModerationService = inject(UserModerationService),
  ) {
    this.app = new OpenAPIHono();
    this.setRoutes();
  }

  public getRouter(): OpenAPIHono<{ Variables: HonoVariables }> {
    return this.app;
  }

  private setRoutes(): void {
    this.registerGetUserReportsRoute();
    this.registerGetUserAutomaticReportsRoute();
    this.registerGetUserBansRoute();
    this.registerBanUserRoute();
    this.registerUnbanUserRoute();
  }

  private registerGetUserReportsRoute(): void {
    this.app.openapi(
      createRoute({
        method: "get",
        path: "/reports",
        summary: "Get user reports",
        description:
          "Retrieves manual reports with pagination. Optionally filters by user",
        tags: ["User reports"],
        request: {
          query: GetUserReportsManualQuerySchema,
        },
        responses: {
          200: {
            description: "Responds with user reports data",
            content: {
              "application/json": {
                schema: GetUserReportsManualResponseSchema,
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
        const query = c.req.valid("query");

        const response = await this.userModerationService.getUserManualReports(
          query,
        );

        return c.json(response, 200);
      },
    );
  }

  private registerGetUserAutomaticReportsRoute(): void {
    this.app.openapi(
      createRoute({
        method: "get",
        path: "/reports/automatic",
        summary: "Get automatic anti-cheat reports",
        description:
          "Retrieves automatic anti-cheat reports with pagination. Optionally filters by user",
        tags: ["User reports"],
        request: {
          query: GetUserReportsAutomaticQuerySchema,
        },
        responses: {
          200: {
            description: "Responds with automatic anti-cheat reports data",
            content: {
              "application/json": {
                schema: GetUserReportsAutomaticResponseSchema,
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
        const query = c.req.valid("query");

        const response =
          await this.userModerationService.getUserAutomaticReports(query);

        return c.json(response, 200);
      },
    );
  }

  private registerGetUserBansRoute(): void {
    this.app.openapi(
      createRoute({
        method: "get",
        path: "/bans",
        summary: "Get user bans",
        description:
          "Retrieves bans with pagination. Optionally filters by user",
        tags: ["User bans"],
        request: {
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
        const query = c.req.valid("query");

        const response = await this.userModerationService.getUserBans(query);

        return c.json(response, 200);
      },
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
        const issuerUserId = c.get("userId");
        await this.userModerationService.banUser(validated, issuerUserId);
        return c.body(null, 204);
      },
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
      },
    );
  }
}
