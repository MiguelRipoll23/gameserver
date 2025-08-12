import { inject, injectable } from "@needle-di/core";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { UserRolesService } from "../../services/user-roles-service.ts";
import {
  AddUserRoleRequestSchema,
  RemoveUserRoleRequestSchema,
  GetUserRolesResponseSchema,
  GetUserRolesQuerySchema,
} from "../../schemas/user-roles-schemas.ts";
import { ServerResponse } from "../../models/server-response.ts";

@injectable()
export class ManagementUserRolesRouter {
  private app: OpenAPIHono;

  constructor(private userRolesService = inject(UserRolesService)) {
    this.app = new OpenAPIHono();
    this.setRoutes();
  }

  public getRouter(): OpenAPIHono {
    return this.app;
  }

  private setRoutes(): void {
    this.registerGetUserRolesRoute();
    this.registerAddUserRoleRoute();
    this.registerRemoveUserRoleRoute();
  }

  private registerGetUserRolesRoute(): void {
    this.app.openapi(
      createRoute({
        method: "get",
        path: "/:userId",
        summary: "Get user roles",
        description:
          "Retrieves all roles assigned to a specific user with pagination",
        tags: ["User roles"],
        request: {
          params: z.object({
            userId: z
              .string()
              .length(36)
              .describe("The user ID to get roles for"),
          }),
          query: GetUserRolesQuerySchema,
        },
        responses: {
          200: {
            description: "Responds with user roles data",
            content: {
              "application/json": {
                schema: GetUserRolesResponseSchema,
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

        const response = await this.userRolesService.getUserRoles({
          userId,
          cursor,
          limit,
        });

        return c.json(response, 200);
      }
    );
  }

  private registerAddUserRoleRoute(): void {
    this.app.openapi(
      createRoute({
        method: "post",
        path: "/add",
        summary: "Add user role",
        description: "Assigns a role to a specific user",
        tags: ["User roles"],
        request: {
          body: {
            content: {
              "application/json": {
                schema: AddUserRoleRequestSchema,
              },
            },
          },
        },
        responses: {
          204: {
            description: "Role successfully added to user",
          },
          ...ServerResponse.BadRequest,
          ...ServerResponse.Unauthorized,
          ...ServerResponse.Forbidden,
          ...ServerResponse.NotFound,
          ...ServerResponse.Conflict,
        },
      }),
      async (c) => {
        const body = c.req.valid("json");

        await this.userRolesService.addUserRole(body);

        return c.body(null, 204);
      }
    );
  }

  private registerRemoveUserRoleRoute(): void {
    this.app.openapi(
      createRoute({
        method: "delete",
        path: "/remove",
        summary: "Remove user role",
        description: "Removes a role from a specific user",
        tags: ["User roles"],
        request: {
          body: {
            content: {
              "application/json": {
                schema: RemoveUserRoleRequestSchema,
              },
            },
          },
        },
        responses: {
          204: {
            description: "Role successfully removed from user",
          },
          ...ServerResponse.BadRequest,
          ...ServerResponse.Unauthorized,
          ...ServerResponse.Forbidden,
          ...ServerResponse.NotFound,
        },
      }),
      async (c) => {
        const body = c.req.valid("json");

        await this.userRolesService.removeUserRole(body);

        return c.body(null, 204);
      }
    );
  }
}
