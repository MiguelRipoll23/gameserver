import { OpenAPIHono } from "@hono/zod-openapi";
import { inject, injectable } from "@needle-di/core";
import { V1ModeratorAuthorizationMiddleware } from "../../../middlewares/moderator-authorization-middleware.ts";
import { ManagementUserModerationRouter } from "./management/management-user-moderation-router.ts";

@injectable()
export class V1ModerationRouter {
  private app: OpenAPIHono;

  constructor(
    private moderatorAuthorizationMiddleware = inject(V1ModeratorAuthorizationMiddleware),
    private userModerationRouter = inject(ManagementUserModerationRouter)
  ) {
    this.app = new OpenAPIHono();
    this.setMiddlewares();
    this.setRoutes();
  }

  public getRouter(): OpenAPIHono {
    return this.app;
  }

  private setMiddlewares(): void {
    this.setModeratorAuthorizationMiddleware();
  }

  private setModeratorAuthorizationMiddleware(): void {
    this.app.use("*", this.moderatorAuthorizationMiddleware.create());
  }

  private setRoutes(): void {
    this.app.route("/user-moderation", this.userModerationRouter.getRouter());
  }
}
