import { sign, verify } from "hono/jwt";
import { injectable } from "@needle-di/core";
import { ENV_JWT_SECRET } from "../../api/versions/v1/constants/environment-constants.ts";
import { ServerError } from "../../api/versions/v1/models/server-error.ts";
import { JWTPayload } from "../../../../../../AppData/Local/deno/npm/registry.npmjs.org/hono/4.12.0/dist/types/utils/jwt/types.d.ts";
import { SignatureAlgorithm } from "../../../../../../AppData/Local/deno/npm/registry.npmjs.org/hono/4.12.0/dist/types/utils/jwt/jwa.d.ts";

@injectable()
export class JWTService {
  private static SIGNATURE_ALGORITHM: SignatureAlgorithm = "HS256";
  private secret: string;

  constructor() {
    this.secret = this.setSecret();
  }

  public getSecret(): string {
    return this.secret;
  }

  public getSignatureAlgorithm(): SignatureAlgorithm {
    return JWTService.SIGNATURE_ALGORITHM;
  }

  public async sign(payload: Record<string, unknown>): Promise<string> {
    return await sign(payload, this.secret, JWTService.SIGNATURE_ALGORITHM);
  }

  public async verify(jwt: string): Promise<JWTPayload> {
    let payload = null;

    try {
      payload = await verify(jwt, this.secret, JWTService.SIGNATURE_ALGORITHM);
    } catch (error) {
      console.error(error);
    }

    if (payload === null) {
      throw new ServerError("INVALID_TOKEN", "Invalid token", 401);
    }

    return payload;
  }

  private setSecret(): string {
    const secret: string | undefined = Deno.env.get(ENV_JWT_SECRET);

    if (secret === undefined) {
      console.warn("⚠️ JWT_SECRET not set — using in-memory key");
      return "in-memory-secret";
    }

    return secret;
  }
}
