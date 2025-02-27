import { createMiddleware } from "hono/factory";
import { injectable } from "@needle-di/core";
import { ServerError } from "../versions/v1/models/server-error.ts";

@injectable()
export class AuthorizationMiddleware {
  public create() {
    return createMiddleware(async (c, next) => {
      const roles = c.get("userRoles");
      this.hasManagementRole(roles);
      await next();
    });
  }

  private hasManagementRole(roles: string[]): void {
    if (roles.includes("management") === false) {
      throw new ServerError(
        "NO_MANAGEMENT_ROLE",
        "Missing management role",
        403,
      );
    }
  }
}
