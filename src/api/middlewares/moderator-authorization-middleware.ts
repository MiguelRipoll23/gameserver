import { createMiddleware } from "hono/factory";
import { injectable } from "@needle-di/core";
import { ServerError } from "../versions/v1/models/server-error.ts";

@injectable()
export class ModeratorAuthorizationMiddleware {
  public create() {
    return createMiddleware(async (c, next) => {
      const roles = c.get("userRoles");
      this.hasManagerOrModeratorRole(roles);
      await next();
    });
  }

  private hasManagerOrModeratorRole(roles: string[] | undefined): void {
    if (!roles?.some((role) => role === "moderator" || role === "manager")) {
      throw new ServerError(
        "NO_MANAGER_OR_MODERATOR_ROLE",
        "Missing manager or moderator role",
        403,
      );
    }
  }
}
