import { encodeBase64 } from "@std/encoding/base64";

export class AuthenticationUtils {
  public static generateSessionId(): string {
    const sessionIdBytes: Uint8Array = crypto.getRandomValues(
      new Uint8Array(32)
    );

    return encodeBase64(sessionIdBytes);
  }
}
