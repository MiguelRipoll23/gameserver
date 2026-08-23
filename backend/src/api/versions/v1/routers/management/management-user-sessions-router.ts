import { inject, injectable } from "@needle-di/core";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { SessionsService } from "../../services/sessions-service.ts";
import {
  DeleteUserSessionParamsSchema,
  GetUserSessionsQuerySchema,
  GetUserSessionsResponseSchema,
} from "../../schemas/user-sessions-schemas.ts";
import { ServerResponse } from "../../models/server-response.ts";

@injectable()
export class ManagementUserSessionsRouter {
  private app: OpenAPIHono;

  constructor(private sessionsService = inject(SessionsService)) {
    this.app = new OpenAPIHono();
    this.setRoutes();
  }

  public getRouter(): OpenAPIHono {
    return this.app;
  }

  private setRoutes(): void {
    this.registerGetUserSessionsRoute();
    this.registerDeleteUserSessionRoute();
  }

  private registerGetUserSessionsRoute(): void {
    this.app.openapi(
      createRoute({
        method: "get",
        path: "/",
        summary: "Get user sessions",
        description: "Retrieves all user sessions with pagination",
        tags: ["User sessions"],
        request: {
          query: GetUserSessionsQuerySchema,
        },
        responses: {
          200: {
            description: "Responds with user sessions data",
            content: {
              "application/json": {
                schema: GetUserSessionsResponseSchema,
              },
            },
          },
          ...ServerResponse.BadRequest,
          ...ServerResponse.Unauthorized,
          ...ServerResponse.Forbidden,
        },
      }),
      async (c) => {
        const query = c.req.valid("query");
        const response = await this.sessionsService.list(query);

        return c.json(response, 200);
      },
    );
  }

  private registerDeleteUserSessionRoute(): void {
    this.app.openapi(
      createRoute({
        method: "delete",
        path: "/:userId",
        summary: "Delete user session",
        description: "Deletes the session for the specified user",
        tags: ["User sessions"],
        request: {
          params: DeleteUserSessionParamsSchema,
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
        await this.sessionsService.deleteById(userId);

        return c.body(null, 204);
      },
    );
  }
}
