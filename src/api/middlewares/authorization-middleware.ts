import { createMiddleware } from "hono/factory";
import { injectable } from "@needle-di/core";
import { ServerError } from "../versions/v1/models/server-error.ts";

const USER_MODERATION_PATH_PREFIX = "/api/v1/user-moderation";

@injectable()
export class AuthorizationManagerMiddleware {
  public create() {
    return createMiddleware(async (c, next) => {
      if (c.req.path.startsWith(USER_MODERATION_PATH_PREFIX)) {
        await next();
        return;
      }

      const roles = c.get("userRoles");
      this.hasManagerRole(roles);
      await next();
    });
  }

  private hasManagerRole(roles: string[]): void {
    if (roles.includes("manager") === false) {
      throw new ServerError(
        "NO_MANAGER_ROLE",
        "Missing manager role",
        403,
      );
    }
  }
}
