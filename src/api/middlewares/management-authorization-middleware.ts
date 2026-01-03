import { createMiddleware } from "hono/factory";
import { injectable } from "@needle-di/core";
import { ServerError } from "../versions/v1/models/server-error.ts";

@injectable()
export class ManagementAuthorizationMiddleware {
  public create() {
    return createMiddleware(async (c, next) => {
      const roles = c.get("userRoles");
      this.hasManagerRole(roles);
      await next();
    });
  }

  private hasManagerRole(roles: string[] | undefined): void {
    if (!roles?.includes("manager")) {
      throw new ServerError(
        "NO_MANAGER_ROLE",
        "Missing manager role",
        403,
      );
    }
  }
}
