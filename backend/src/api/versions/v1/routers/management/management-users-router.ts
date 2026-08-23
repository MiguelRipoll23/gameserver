import { inject, injectable } from "@needle-di/core";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { UsersService } from "../../services/users-service.ts";
import {
  GetUsersQuerySchema,
  GetUsersResponseSchema,
  UpdateUserRequestSchema,
} from "../../schemas/users-schemas.ts";
import { ServerResponse } from "../../models/server-response.ts";

@injectable()
export class ManagementUsersRouter {
  private app: OpenAPIHono;

  constructor(private usersService = inject(UsersService)) {
    this.app = new OpenAPIHono();
    this.setRoutes();
  }

  public getRouter(): OpenAPIHono {
    return this.app;
  }

  private setRoutes(): void {
    this.registerGetUsersRoute();
    this.registerUpdateUserRoute();
  }

  private registerGetUsersRoute(): void {
    this.app.openapi(
      createRoute({
        method: "get",
        path: "/",
        summary: "Get users",
        description: "Retrieves all users with pagination",
        tags: ["Users"],
        request: {
          query: GetUsersQuerySchema,
        },
        responses: {
          200: {
            description: "Responds with users data",
            content: {
              "application/json": {
                schema: GetUsersResponseSchema,
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

        const response = await this.usersService.list({ cursor, limit });

        return c.json(response, 200);
      },
    );
  }

  private registerUpdateUserRoute(): void {
    this.app.openapi(
      createRoute({
        method: "put",
        path: "/:userId",
        summary: "Update user",
        description: "Updates the display name of a user",
        tags: ["Users"],
        request: {
          params: z.object({
            userId: z
              .string()
              .uuid()
              .describe("The ID of the user to update"),
          }),
          body: {
            content: {
              "application/json": {
                schema: UpdateUserRequestSchema,
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
          ...ServerResponse.Conflict,
        },
      }),
      async (c) => {
        const userId = c.req.param("userId");
        const { displayName } = c.req.valid("json");

        await this.usersService.updateUser(userId, displayName);

        return c.body(null, 204);
      },
    );
  }
}