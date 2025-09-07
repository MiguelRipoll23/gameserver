import { inject, injectable } from "@needle-di/core";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { ServerMessagesService } from "../../services/server-messages-service.ts";
import {
  GetServerMessagesQuerySchema,
  GetServerMessagesResponseSchema,
} from "../../schemas/server-messages-schemas.ts";
import { ServerResponse } from "../../models/server-response.ts";

@injectable()
export class AuthenticatedServerMessagesRouter {
  private app: OpenAPIHono;

  constructor(private serverMessagesService = inject(ServerMessagesService)) {
    this.app = new OpenAPIHono();
    this.setRoutes();
  }

  public getRouter(): OpenAPIHono {
    return this.app;
  }

  private setRoutes(): void {
    this.registerGetServerMessagesRoute();
  }

  private registerGetServerMessagesRoute(): void {
    this.app.openapi(
      createRoute({
        method: "get",
        path: "/",
        summary: "Get server messages",
        description:
          "Server messages shown to the player after connecting to server",
        tags: ["Server message"],
        request: {
          query: GetServerMessagesQuerySchema,
        },
        responses: {
          200: {
            description: "Responds with data",
            content: {
              "application/json": {
                schema: GetServerMessagesResponseSchema,
              },
            },
          },
          ...ServerResponse.Unauthorized,
        },
      }),
      async (c) => {
        const { cursor, limit } = c.req.valid("query");
        const response = await this.serverMessagesService.list({
          cursor,
          limit,
        });

        return c.json(response, 200);
      },
    );
  }
}
