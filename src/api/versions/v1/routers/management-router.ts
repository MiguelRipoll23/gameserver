import { OpenAPIHono } from "@hono/zod-openapi";
import { inject, injectable } from "@needle-di/core";
import { AuthorizationMiddleware } from "../../../middlewares/authorization-middleware.ts";
import { ManagementNotificationRouter } from "./management/management-notification-router.ts";
import { ManagementMessageRouter } from "./management/management-message-router.ts";
import { ManagementConfigurationRouter } from "./management/management-configuration-router.ts";
import { ManagementVersionRouter } from "./management/management-version-router.ts";

@injectable()
export class V1ManagementRouter {
  private app: OpenAPIHono;

  constructor(
    private authorizationMiddleware = inject(AuthorizationMiddleware),
    private versionRouter = inject(ManagementVersionRouter),
    private configurationRouter = inject(ManagementConfigurationRouter),
    private messageRouter = inject(ManagementMessageRouter),
    private notificationRouter = inject(ManagementNotificationRouter),
  ) {
    this.app = new OpenAPIHono();
    this.setMiddlewares();
    this.setRoutes();
  }

  public getRouter(): OpenAPIHono {
    return this.app;
  }

  private setMiddlewares(): void {
    this.setAuthorizationMiddleware();
  }

  private setAuthorizationMiddleware(): void {
    this.app.use("*", this.authorizationMiddleware.create());
  }

  private setRoutes(): void {
    this.app.route("/game-version", this.versionRouter.getRouter());
    this.app.route("/game-configuration", this.configurationRouter.getRouter());
    this.app.route("/server-messages", this.messageRouter.getRouter());
    this.app.route("/server-notification", this.notificationRouter.getRouter());
  }
}
