import { Payload, verify } from "@wok/djwt";
import { injectable } from "@needle-di/core";
import { ENV_JWT_SECRET } from "../../api/versions/v1/constants/environment-constants.ts";
import { ServerError } from "../../api/versions/v1/models/server-error.ts";

@injectable()
export class JWTService {
  private key: CryptoKey | null = null;

  public async getKey(): Promise<CryptoKey> {
    if (this.key !== null) {
      return this.key;
    }

    const secret: string | undefined = Deno.env.get(ENV_JWT_SECRET);

    if (secret === undefined) {
      // Fallback to an in-memory key when no secret is configured.
      console.warn("⚠️ JWT_SECRET not set — using in-memory key");
      this.key = await crypto.subtle.generateKey(
        {
          name: "HMAC",
          hash: "SHA-512",
        },
        true,
        ["sign", "verify"],
      );
    } else {
      const secretBytes = new TextEncoder().encode(secret);

      this.key = await crypto.subtle.importKey(
        "raw",
        secretBytes,
        {
          name: "HMAC",
          hash: "SHA-512",
        },
        true,
        ["sign", "verify"],
      );
    }

    return this.key;
  }

  public async verify(jwt: string): Promise<Payload> {
    const jwtKey = await this.getKey();

    let payload = null;

    try {
      payload = await verify(jwt, jwtKey);
    } catch (error) {
      console.error(error);
    }

    if (payload === null) {
      throw new ServerError("INVALID_TOKEN", "Invalid token", 401);
    }

    return payload;
  }
}
