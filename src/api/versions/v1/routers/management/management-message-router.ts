import { inject, injectable } from "@needle-di/core";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { MessagesService } from "../../services/messages-service.ts";
import {
  CreateMessageRequestSchema,
  DeleteMessageRequestSchema,
} from "../../schemas/messages-schemas.ts";
import { ServerResponse } from "../../models/server-response.ts";

@injectable()
export class ManagementMessageRouter {
  private app: OpenAPIHono;

  constructor(private messageService = inject(MessagesService)) {
    this.app = new OpenAPIHono();
    this.setRoutes();
  }

  public getRouter(): OpenAPIHono {
    return this.app;
  }

  private setRoutes(): void {
    this.registerCreateMessageRoute();
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
                schema: CreateMessageRequestSchema,
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
        await this.messageService.create(validated);

        return c.body(null, 204);
      },
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
          params: DeleteMessageRequestSchema,
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
        await this.messageService.delete(id);

        return c.body(null, 204);
      },
    );
  }
}
