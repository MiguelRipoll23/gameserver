import { inject, injectable } from "@needle-di/core";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { NotificationService } from "../../services/notification-service.ts";
import { PushServerNotificationSchema, PushUserNotificationSchema } from "../../schemas/notification-schemas.ts";
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
    this.registerPushUserNotificationRoute();
  }

  private registerPushServerNotificationRoute(): void {
    this.app.openapi(
      createRoute({
        method: "post",
        path: "/",
        summary: "Push global notification",
        description: "Shows a server in-game notification to connected users",
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

  private registerPushUserNotificationRoute(): void {
    this.app.openapi(
      createRoute({
        method: "post",
        path: "/user",
        summary: "Push user notification",
        description: "Shows a server in-game notification to an user",
        tags: ["Server notification"],
        request: {
          body: {
            content: {
              "application/json": {
                schema: PushUserNotificationSchema,
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
        const { userId, message } = c.req.valid("json");
        this.notificationService.notifyUser(userId, message);

        return c.body(null, 204);
      },
    );
  }
}
