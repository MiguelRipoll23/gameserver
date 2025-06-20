import { inject, injectable } from "@needle-di/core";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { NotificationService } from "../../services/notification-service.ts";
import { PushServerNotificationSchema } from "../../schemas/notification-schemas.ts";
import { ServerResponse } from "../../models/server-response.ts";

@injectable()
export class ManagementNotificationRouter {
  private app: OpenAPIHono;

  constructor(private notificationService = inject(NotificationService)) {
    this.app = new OpenAPIHono();
    this.setRoutes();
  }

  public getRouter(): OpenAPIHono {
    return this.app;
  }

  private setRoutes(): void {
    this.registerPushServerNotificationRoute();
  }

  private registerPushServerNotificationRoute(): void {
    this.app.openapi(
      createRoute({
        method: "post",
        path: "/",
        summary: "Push server notification",
        description: "Shows a server in-game notification to connected players",
        tags: ["Server notification"],
        request: {
          body: {
            content: {
              "text/plain": {
                schema: PushServerNotificationSchema,
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
        const text = await c.req.text();
        this.notificationService.notify(text);

        return c.body(null, 204);
      },
    );
  }
}
