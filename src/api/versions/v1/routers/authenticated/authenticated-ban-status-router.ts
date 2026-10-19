import { inject, injectable } from "@needle-di/core";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { UserModerationService } from "../../services/user-moderation-service.ts";
import { HonoVariables } from "../../../../../core/types/hono-variables-type.ts";
import { BanStatusResponseSchema } from "../../schemas/user-moderation-schemas.ts";
import { ServerResponse } from "../../models/server-response.ts";

/**
 * Player-facing moderation routes.
 *
 * Report submission lives on {@link AuthenticatedUserModerationRouter}; this
 * router only exposes the authenticated player's own ban status, so a game
 * client can show a ban screen without reading the bans table.
 */
@injectable()
export class AuthenticatedBanStatusRouter {
  private app: OpenAPIHono<{ Variables: HonoVariables }>;

  constructor(private userModerationService = inject(UserModerationService)) {
    this.app = new OpenAPIHono();
    this.setRoutes();
  }

  public getRouter(): OpenAPIHono<{ Variables: HonoVariables }> {
    return this.app;
  }

  private setRoutes(): void {
    this.registerGetBanStatusRoute();
  }

  private registerGetBanStatusRoute(): void {
    this.app.openapi(
      createRoute({
        method: "get",
        path: "/",
        summary: "Get own ban status",
        description:
          "Tells a player whether their account is currently banned and why",
        tags: ["User bans"],
        responses: {
          200: {
            description: "Responds with the player's ban status",
            content: {
              "application/json": {
                schema: BanStatusResponseSchema,
              },
            },
          },
          ...ServerResponse.Unauthorized,
          ...ServerResponse.NotFound,
        },
      }),
      async (c) => {
        const userId = c.get("userId");
        const ban = await this.userModerationService.getActiveBan(userId);

        return c.json(
          ban
            ? {
                banned: true,
                reason: ban.reason,
                expiresAt: ban.expiresAt,
              }
            : { banned: false, reason: null, expiresAt: null },
          200,
        );
      },
    );
  }
}
