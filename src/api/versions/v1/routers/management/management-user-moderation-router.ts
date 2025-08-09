import { inject, injectable } from "@needle-di/core";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { UserModerationService } from "../../services/user-moderation-service.ts";
import {
  BanUserRequestSchema,
  UnbanUserRequestSchema,
} from "../../schemas/moderation-schemas.ts";
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
    this.registerBanUserRoute();
    this.registerUnbanUserRoute();
  }

  private registerBanUserRoute(): void {
    this.app.openapi(
      createRoute({
        method: "post",
        path: "/ban",
        summary: "Ban user",
        description: "Temporarily or permanently bans a user",
        tags: ["User moderation"],
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
        tags: ["User moderation"],
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
