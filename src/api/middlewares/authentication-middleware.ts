import { createMiddleware } from "hono/factory";
import type { MiddlewareHandler } from "hono";
import { inject, injectable } from "@needle-di/core";
import { ServerError } from "../versions/v1/models/server-error.ts";
import { JWTService } from "../../core/services/jwt-service.ts";

@injectable()
export class AuthenticationMiddleware {
  constructor(private jwtService = inject(JWTService)) {}

  public create(): MiddlewareHandler[] {
    return [
      this.jwtService.getAuthMiddleware(),
      createMiddleware(async (context, next) => {
        const payload = context.get("jwtPayload");

        if (typeof payload?.sub !== "string" || payload.sub.length === 0) {
          throw new ServerError("INVALID_TOKEN", "Missing subject claim", 401);
        }

        if (typeof payload?.name !== "string" || payload.name.length === 0) {
          throw new ServerError("INVALID_TOKEN", "Missing name claim", 401);
        }

        context.set("userId", payload.sub);
        context.set("userName", payload.name);
        context.set(
          "userRoles",
          Array.isArray(payload.roles)
            ? payload.roles.filter((role): role is string => typeof role === "string")
            : [],
        );

        await next();
      }),
    ];
  }
}
