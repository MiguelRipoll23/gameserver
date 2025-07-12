import { create, Payload, verify } from "@wok/djwt";
import { CryptoUtils } from "../utils/crypto-utils.ts";
import { injectable } from "@needle-di/core";
import { ServerError } from "../../api/versions/v1/models/server-error.ts";
import { ENV_JWT_SECRET } from "../../api/versions/v1/constants/env-constants.ts";
import {
  INVALID_TOKEN_MESSAGE,
} from "../../api/versions/v1/constants/api-constants.ts";

@injectable()
export class JWTService {
  private key: CryptoKey | null = null;

  public async getKey(): Promise<CryptoKey> {
    if (this.key !== null) {
      return this.key;
    }

    const secret: string | undefined = Deno.env.get(ENV_JWT_SECRET);

    if (secret === undefined) {
      throw new Error("Environment variable not set");
    }

    const encodedSecret = btoa(secret);

    this.key = await CryptoUtils.base64ToCryptoKey(
      encodedSecret,
      {
        name: "HMAC",
        hash: "SHA-512",
      },
      ["sign", "verify"],
    );

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
      throw new ServerError("INVALID_TOKEN", INVALID_TOKEN_MESSAGE, 401);
    }

    return payload;
  }

  public async getManagementToken() {
    return await create(
      { alg: "HS512", typ: "JWT" },
      { id: "management", name: "management", roles: ["management"] },
      await this.getKey(),
    );
  }
}
