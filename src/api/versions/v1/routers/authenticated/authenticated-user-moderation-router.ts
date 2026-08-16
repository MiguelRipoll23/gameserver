import { inject, injectable } from "@needle-di/core";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { UserModerationService } from "../../services/user-moderation-service.ts";
import { HonoVariables } from "../../../../../core/types/hono-variables-type.ts";
import {
  AutomaticReportUserRequestSchema,
  ManualReportUserRequestSchema,
} from "../../schemas/user-moderation-schemas.ts";
import { ServerResponse } from "../../models/server-response.ts";

@injectable()
export class AuthenticatedUserModerationRouter {
  private app: OpenAPIHono<{ Variables: HonoVariables }>;

  constructor(private userModerationService = inject(UserModerationService)) {
    this.app = new OpenAPIHono();
    this.setRoutes();
  }

  public getRouter(): OpenAPIHono<{ Variables: HonoVariables }> {
    return this.app;
  }

  private setRoutes(): void {
    this.registerManualReportUserRoute();
    this.registerAutomaticReportUserRoute();
  }

  private registerManualReportUserRoute(): void {
    this.app.openapi(
      createRoute({
        method: "post",
        path: "/manual-report",
        summary: "Report user",
        description: "Reports a user for breaking the rules",
        tags: ["User reports"],
        request: {
          body: {
            content: {
              "application/json": {
                schema: ManualReportUserRequestSchema,
              },
            },
          },
        },
        responses: {
          ...ServerResponse.Created,
          ...ServerResponse.BadRequest,
          ...ServerResponse.Unauthorized,
          ...ServerResponse.NotFound,
        },
      }),
      async (c) => {
        const reporterId = c.get("userId");
        const validated = c.req.valid("json");
        await this.userModerationService.reportUserManual(
          reporterId,
          validated,
        );
        return c.body(null, 201);
      },
    );
  }

  private registerAutomaticReportUserRoute(): void {
    this.app.openapi(
      createRoute({
        method: "post",
        path: "/automatic-report",
        summary: "Report anti-cheat violation",
        description:
          "Reports an automatically detected anti-cheat violation. When the broken rule's action is 'ban', the user is temporarily banned for one day",
        tags: ["User reports"],
        request: {
          body: {
            content: {
              "application/json": {
                schema: AutomaticReportUserRequestSchema,
              },
            },
          },
        },
        responses: {
          ...ServerResponse.Created,
          ...ServerResponse.BadRequest,
          ...ServerResponse.Unauthorized,
          ...ServerResponse.NotFound,
        },
      }),
      async (c) => {
        const issuerId = c.get("userId");
        const validated = c.req.valid("json");
        await this.userModerationService.reportAutomaticViolation(
          validated,
          issuerId,
        );
        return c.body(null, 201);
      },
    );
  }
}
