import { createMiddleware } from "hono/factory";
import { inject, injectable } from "@needle-di/core";
import { ServerError } from "../versions/v1/models/server-error.ts";
import { JWTService } from "../../core/services/jwt-service.ts";

@injectable()
export class AuthenticationMiddleware {
  constructor(private jwtService = inject(JWTService)) {}

  public create() {
    return createMiddleware(async (c, next) => {
      const authorization = c.req.header("Authorization") ?? null;
      const accessToken = c.req.query("access_token") ?? null;
      const jwt = this.getTokenFromContext(authorization, accessToken);
      const payload = await this.jwtService.verify(jwt);

      c.set("userId", payload.sub);
      c.set("userName", payload.name);
      c.set("userRoles", payload.roles ?? []);

      await next();
    });
  }

  public getTokenFromContext(
    authorization: string | null,
    accessToken: string | null,
  ): string {
    const token =
      authorization === null
        ? accessToken
        : authorization.replace("Bearer", "").trim();

    if (token === null || token.length === 0) {
      throw new ServerError("NO_TOKEN_PROVIDED", "No token provided", 401);
    }

    return token;
  }
}
