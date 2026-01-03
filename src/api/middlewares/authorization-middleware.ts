import { createMiddleware } from "hono/factory";
import { injectable } from "@needle-di/core";
import { ServerError } from "../versions/v1/models/server-error.ts";

@injectable()
export class AuthorizationManagerMiddleware {
  public create() {
    return createMiddleware(async (c, next) => {
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
