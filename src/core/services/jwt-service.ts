import { sign, verify } from "hono/jwt";
import { jwt } from "hono/jwt";
import type { MiddlewareHandler } from "hono";
import { injectable } from "@needle-di/core";
import { ENV_JWT_SECRET } from "../../api/versions/v1/constants/environment-constants.ts";
import { ServerError } from "../../api/versions/v1/models/server-error.ts";

@injectable()
export class JWTService {
  private static EXPIRATION_SECONDS = 1800;
  private secret: string;

  constructor() {
    this.secret = this.resolveSecret();
  }

  public async sign(
    payload: Record<string, unknown>,
    expiresInSeconds = JWTService.EXPIRATION_SECONDS,
  ): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const finalPayload: Record<string, unknown> = {
      iat: now,
      exp: now + expiresInSeconds,
      ...payload, // caller-supplied exp/iat wins if present
    };

    return await sign(finalPayload, this.secret, "HS256");
  }

  public async verify(jwt: string): Promise<Record<string, unknown>> {
    let payload: Record<string, unknown> | null = null;

    try {
      payload = await verify(jwt, this.secret, "HS256");
    } catch (error) {
      console.error(error);
    }

    if (payload === null) {
      throw new ServerError("INVALID_TOKEN", "Invalid token", 401);
    }

    return payload;
  }

  public getAuthMiddleware(): MiddlewareHandler {
    return jwt({
      secret: this.secret,
      alg: "HS256",
    });
  }

  private resolveSecret(): string {
    const secret: string | undefined = Deno.env.get(ENV_JWT_SECRET);

    if (secret === undefined) {
      throw new Error("JWT secret is not defined in environment variables");
    }

    return secret;
  }
}
