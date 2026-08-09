import { OpenAPIHono } from "@hono/zod-openapi";
import { inject, injectable } from "@needle-di/core";
import { ManagementAuthorizationMiddleware } from "../../../middlewares/management-authorization-middleware.ts";
import { AuthenticationMiddleware } from "../../../middlewares/authentication-middleware.ts";
import { HonoVariables } from "../../../../core/types/hono-variables-type.ts";
import { ManagementNotificationRouter } from "./management/management-notification-router.ts";
import { ManagementServerMessagesRouter } from "./management/management-server-messages-router.ts";
import { ManagementConfigurationRouter } from "./management/management-configuration-router.ts";
import { ManagementAntiCheatRulesRouter } from "./management/management-anticheat-rules-router.ts";
import { ManagementVersionRouter } from "./management/management-version-router.ts";
import { ManagementTextModerationRouter } from "./management/management-text-moderation-router.ts";
import { ManagementUserRolesRouter } from "./management/management-user-roles-router.ts";
import { ManagementBotRouter } from "./management/management-bot-router.ts";
import { ManagementUsersRouter } from "./management/management-users-router.ts";
import { ManagementUserSessionsRouter } from "./management/management-user-sessions-router.ts";
import { ManagementUserScoresRouter } from "./management/management-user-scores-router.ts";
import { ManagementMatchesRouter } from "./management/management-matches-router.ts";

@injectable()
export class V1ManagementRouter {
  private app: OpenAPIHono<{ Variables: HonoVariables }>;

  constructor(
    private authenticationMiddleware = inject(AuthenticationMiddleware),
    private managementAuthorizationMiddleware = inject(
      ManagementAuthorizationMiddleware,
    ),
    private versionRouter = inject(ManagementVersionRouter),
    private configurationRouter = inject(ManagementConfigurationRouter),
    private antiCheatRulesRouter = inject(ManagementAntiCheatRulesRouter),
    private serverMessagesRouter = inject(ManagementServerMessagesRouter),
    private notificationRouter = inject(ManagementNotificationRouter),
    private textModerationRouter = inject(ManagementTextModerationRouter),
    private userRolesRouter = inject(ManagementUserRolesRouter),
    private botRouter = inject(ManagementBotRouter),
    private usersRouter = inject(ManagementUsersRouter),
    private userSessionsRouter = inject(ManagementUserSessionsRouter),
    private userScoresRouter = inject(ManagementUserScoresRouter),
    private matchesRouter = inject(ManagementMatchesRouter),
  ) {
    this.app = new OpenAPIHono();
    this.setMiddlewares();
    this.setRoutes();
  }

  public getRouter(): OpenAPIHono<{ Variables: HonoVariables }> {
    return this.app;
  }

  private setMiddlewares(): void {
    this.setAuthenticationMiddleware();
    this.setAuthorizationManagerMiddleware();
  }

  private setAuthenticationMiddleware(): void {
    this.app.use("*", ...this.authenticationMiddleware.create());
  }

  private setAuthorizationManagerMiddleware(): void {
    this.app.use("*", this.managementAuthorizationMiddleware.create());
  }

  private setRoutes(): void {
    this.app.route("/game-version", this.versionRouter.getRouter());
    this.app.route("/game-configuration", this.configurationRouter.getRouter());
    this.app.route("/anti-cheat-rules", this.antiCheatRulesRouter.getRouter());
    this.app.route("/server-messages", this.serverMessagesRouter.getRouter());
    this.app.route("/server-notification", this.notificationRouter.getRouter());
    this.app.route("/users", this.usersRouter.getRouter());
    this.app.route("/user-roles", this.userRolesRouter.getRouter());
    this.app.route("/user-sessions", this.userSessionsRouter.getRouter());
    this.app.route("/user-scores", this.userScoresRouter.getRouter());
    this.app.route("/matches", this.matchesRouter.getRouter());
    this.app.route("/bots", this.botRouter.getRouter());
    this.app.route("/text-moderation", this.textModerationRouter.getRouter());
  }
}
