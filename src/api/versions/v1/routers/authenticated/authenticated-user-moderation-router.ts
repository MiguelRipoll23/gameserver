import { inject, injectable } from "@needle-di/core";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { UserModerationService } from "../../services/user-moderation-service.ts";
import { HonoVariablesType } from "../../../../../core/types/hono-variables-type.ts";
import { ReportUserRequestSchema } from "../../schemas/user-moderation-schemas.ts";
import { ServerResponse } from "../../models/server-response.ts";

@injectable()
export class AuthenticatedUserModerationRouter {
  private app: OpenAPIHono<{ Variables: HonoVariablesType }>;

  constructor(private userModerationService = inject(UserModerationService)) {
    this.app = new OpenAPIHono();
    this.setRoutes();
  }

  public getRouter(): OpenAPIHono<{ Variables: HonoVariablesType }> {
    return this.app;
  }

  private setRoutes(): void {
    this.registerReportUserRoute();
  }

  private registerReportUserRoute(): void {
    this.app.openapi(
      createRoute({
        method: "post",
        path: "/report",
        summary: "Report user",
        description: "Reports a user for breaking the rules",
        tags: ["User reports"],
        request: {
          body: {
            content: {
              "application/json": {
                schema: ReportUserRequestSchema,
              },
            },
          },
        },
        responses: {
          ...ServerResponse.NoContent,
          ...ServerResponse.BadRequest,
          ...ServerResponse.Unauthorized,
          ...ServerResponse.NotFound,
        },
      }),
      async (c) => {
        const reporterId = c.get("userId");
        const validated = c.req.valid("json");
        await this.userModerationService.reportUser(reporterId, validated);
        return c.body(null, 204);
      }
    );
  }
}
