import { inject, injectable } from "@needle-di/core";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { ServerMessagesService } from "../../services/server-messages-service.ts";
import {
  CreateServerMessageRequestSchema,
  DeleteServerMessageRequestSchema,
  UpdateServerMessageRequestSchema,
} from "../../schemas/server-messages-schemas.ts";
import { ServerResponse } from "../../models/server-response.ts";

@injectable()
export class ManagementServerMessagesRouter {
  private app: OpenAPIHono;

  constructor(private serverMessagesService = inject(ServerMessagesService)) {
    this.app = new OpenAPIHono();
    this.setRoutes();
  }

  public getRouter(): OpenAPIHono {
    return this.app;
  }

  private setRoutes(): void {
    this.registerCreateMessageRoute();
    this.registerUpdateMessageRoute();
    this.registerDeleteMessageRoute();
  }

  private registerCreateMessageRoute(): void {
    this.app.openapi(
      createRoute({
        method: "post",
        path: "/",
        summary: "Create server message",
        description:
          "Server messages shown to the player after connecting to server",
        tags: ["Server message"],
        request: {
          body: {
            content: {
              "application/json": {
                schema: CreateServerMessageRequestSchema,
              },
            },
          },
        },
        responses: {
          ...ServerResponse.NoContent,
          ...ServerResponse.BadRequest,
          ...ServerResponse.Unauthorized,
          ...ServerResponse.Forbidden,
        },
      }),
      async (c) => {
        const validated = c.req.valid("json");
        await this.serverMessagesService.create(validated);

        return c.body(null, 204);
      }
    );
  }

  private registerUpdateMessageRoute(): void {
    this.app.openapi(
      createRoute({
        method: "patch",
        path: "/:id",
        summary: "Update server message",
        description:
          "Update existing server message shown to the player after connecting to server",
        tags: ["Server message"],
        request: {
          params: DeleteServerMessageRequestSchema,
          body: {
            content: {
              "application/json": {
                schema: UpdateServerMessageRequestSchema,
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
        const id = parseInt(c.req.param("id"), 10);
        const validated = c.req.valid("json");
        await this.serverMessagesService.update({
          ...validated,
          id,
        });

        return c.body(null, 204);
      }
    );
  }

  private registerDeleteMessageRoute(): void {
    this.app.openapi(
      createRoute({
        method: "delete",
        path: "/:id",
        summary: "Delete server message",
        description:
          "Server messages shown to the player after connecting to server",
        tags: ["Server message"],
        request: {
          params: DeleteServerMessageRequestSchema,
        },
        responses: {
          ...ServerResponse.NoContent,
          ...ServerResponse.Unauthorized,
          ...ServerResponse.Forbidden,
          ...ServerResponse.NotFound,
        },
      }),
      async (c) => {
        const id = parseInt(c.req.param("id"), 10);
        if (isNaN(id)) {
          return c.json(
            {
              message: "Invalid message ID format",
            },
            400
          );
        }

        await this.serverMessagesService.delete(id);
        return c.body(null, 204);
      }
    );
  }
}
