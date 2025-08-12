import { OpenAPIHono } from "@hono/zod-openapi";
import { inject, injectable } from "@needle-di/core";
import { AuthorizationMiddleware } from "../../../middlewares/authorization-middleware.ts";
import { ManagementNotificationRouter } from "./management/management-notification-router.ts";
import { ManagementServerMessagesRouter } from "./management/management-server-messages-router.ts";
import { ManagementConfigurationRouter } from "./management/management-configuration-router.ts";
import { ManagementVersionRouter } from "./management/management-version-router.ts";
import { ManagementUserModerationRouter } from "./management/management-user-moderation-router.ts";
import { ManagementTextModerationRouter } from "./management/management-text-moderation-router.ts";
import { ManagementUserRolesRouter } from "./management/management-user-roles-router.ts";

@injectable()
export class V1ManagementUserRouter {
  private app: OpenAPIHono;

  constructor(
    private authorizationMiddleware = inject(AuthorizationMiddleware),
    private versionRouter = inject(ManagementVersionRouter),
    private configurationRouter = inject(ManagementConfigurationRouter),
    private serverMessagesRouter = inject(ManagementServerMessagesRouter),
    private notificationRouter = inject(ManagementNotificationRouter),
    private userModerationRouter = inject(ManagementUserModerationRouter),
    private textModerationRouter = inject(ManagementTextModerationRouter),
    private userRolesRouter = inject(ManagementUserRolesRouter)
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
    this.app.route("/user-moderation", this.userModerationRouter.getRouter());
    this.app.route("/user-roles", this.userRolesRouter.getRouter());
    this.app.route("/text-moderation", this.textModerationRouter.getRouter());
    this.app.route("/game-configuration", this.configurationRouter.getRouter());
    this.app.route("/server-messages", this.serverMessagesRouter.getRouter());
    this.app.route("/server-notification", this.notificationRouter.getRouter());
  }
}
