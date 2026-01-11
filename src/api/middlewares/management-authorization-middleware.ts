import { createMiddleware } from "hono/factory";
import { injectable } from "@needle-di/core";
import { ServerError } from "../versions/v1/models/server-error.ts";

@injectable()
export class ManagementAuthorizationMiddleware {
  public create(allowedRoles: string[] = ["manager"]) {
    return createMiddleware(async (c, next) => {
      const roles = c.get("userRoles");
      this.hasAllowedRole(roles, allowedRoles);
      await next();
    });
  }

  private hasAllowedRole(
    userRoles: string[] | undefined,
    allowedRoles: string[]
  ): void {
    if (!userRoles?.some((role) => allowedRoles.includes(role))) {
      throw new ServerError(
        "NO_PERMISSION",
        "Insufficient permissions",
        403
      );
    }
  }
}
