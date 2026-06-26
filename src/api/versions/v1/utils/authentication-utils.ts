import { encodeBase64 } from "@std/encoding/base64";
import { Base64Utils } from "../../../../core/utils/base64-utils.ts";
import { type AuthenticatorTransportFuture } from "@simplewebauthn/server";
import type { UserCredentialEntity } from "../../../../db/tables/user-credentials-table.ts";

export class AuthenticationUtils {
  public static generateToken(): string {
    const tokenBytes: Uint8Array = crypto.getRandomValues(new Uint8Array(32));

    return encodeBase64(tokenBytes);
  }

  public static async hashToken(token: string): Promise<string> {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(token),
    );

    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  public static transformCredentialForWebAuthn(
    credential: UserCredentialEntity,
  ) {
    const publicKeyBuffer = new Uint8Array(
      Base64Utils.base64UrlToArrayBuffer(credential.publicKey),
    );

    return {
      id: credential.id,
      publicKey: publicKeyBuffer,
      counter: credential.counter,
      transports: credential.transports as
        | AuthenticatorTransportFuture[]
        | undefined,
    };
  }
}
