import { inject, injectable } from "@needle-di/core";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { ServerMessagesService } from "../../services/server-messages-service.ts";
import { GetMessageResponseSchema } from "../../schemas/messages-schemas.ts";
import { ServerResponse } from "../../models/server-response.ts";

@injectable()
export class AuthenticatedMessagesRouter {
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
        responses: {
          200: {
            description: "Responds with data",
            content: {
              "application/json": {
                schema: GetMessageResponseSchema,
              },
            },
          },
          ...ServerResponse.Unauthorized,
        },
      }),
      async (c) => {
        const response = await this.serverMessagesService.list();

        return c.json(response, 200);
      }
    );
  }
}
