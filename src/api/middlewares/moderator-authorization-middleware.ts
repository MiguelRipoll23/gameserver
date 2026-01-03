import { createMiddleware } from "hono/factory";
import { injectable } from "@needle-di/core";
import { ServerError } from "../versions/v1/models/server-error.ts";

@injectable()
export class ModeratorAuthorizationMiddleware {
  public create() {
    return createMiddleware(async (c, next) => {
      const roles = c.get("userRoles");
      this.hasModeratorRole(roles);
      await next();
    });
  }

  private hasModeratorRole(roles: string[]): void {
    if (roles.includes("moderator") === false) {
      throw new ServerError(
        "NO_MODERATOR_ROLE",
        "Missing moderator role",
        403,
      );
    }
  }
}
