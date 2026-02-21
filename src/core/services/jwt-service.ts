import { sign, verify } from "hono/jwt";
import { injectable } from "@needle-di/core";
import { ENV_JWT_SECRET } from "../../api/versions/v1/constants/environment-constants.ts";
import { ServerError } from "../../api/versions/v1/models/server-error.ts";

@injectable()
export class JWTService {
  private secret: string;

  constructor() {
    this.secret = this.resolveSecret();
  }

  public async sign(payload: Record<string, unknown>): Promise<string> {
    return await sign(payload, this.secret, "HS256");
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

  private resolveSecret(): string {
    const secret: string | undefined = Deno.env.get(ENV_JWT_SECRET);

    if (secret === undefined) {
      console.warn("⚠️ JWT_SECRET not set — using random in-memory secret");
      return (
        crypto.randomUUID() +
        crypto.randomUUID() +
        crypto.randomUUID() +
        crypto.randomUUID()
      );
    }

    return secret;
  }
}
