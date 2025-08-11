import { encodeBase64 } from "@std/encoding/base64";

export class AuthenticationUtils {
  public static generateToken(): string {
    const tokenBytes: Uint8Array = crypto.getRandomValues(new Uint8Array(32));

    return encodeBase64(tokenBytes);
  }
}
