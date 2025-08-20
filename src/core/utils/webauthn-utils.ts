export class WebAuthnUtils {
  private static readonly LOCALHOST_RP_ID = "localhost";
  private static readonly LOCALHOST_RP_NAME = "Game server API";
  private static readonly LOCALHOST_ORIGIN = "http://localhost:8000";

  public static getRelyingPartyID(): string {
    return Deno.env.get("RP_ID") ?? WebAuthnUtils.LOCALHOST_RP_ID;
  }

  public static getRelyingPartyName(): string {
    return Deno.env.get("RP_NAME") ?? WebAuthnUtils.LOCALHOST_RP_NAME;
  }

  public static getRelyingPartyOrigin(): string {
    return Deno.env.get("RP_ORIGIN") ?? WebAuthnUtils.LOCALHOST_ORIGIN;
  }
}
