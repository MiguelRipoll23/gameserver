export class AuthenticationUtils {
  public static generateToken(): string {
    const tokenBytes: Uint8Array = crypto.getRandomValues(new Uint8Array(32));

    return Buffer.from(tokenBytes).toString("base64");
  }
}
