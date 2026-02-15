import { create, Payload, verify } from "@wok/djwt";
import { CryptoUtils } from "../utils/crypto-utils.ts";
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
      this.key = await crypto.subtle.generateKey(
        {
          name: "HMAC",
          hash: "SHA-512",
        },
        true,
        ["sign", "verify"],
      );
    } else {
      const encodedSecret = btoa(secret);

      this.key = await CryptoUtils.base64ToCryptoKey(
        encodedSecret,
        {
          name: "HMAC",
          hash: "SHA-512",
        },
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

  public async createManagementToken() {
    return await create(
      { alg: "HS512", typ: "JWT" },
      {
        id: "00000000-0000-0000-0000-000000000000",
        name: "Management",
        roles: ["manager"],
      },
      await this.getKey(),
    );
  }
}
