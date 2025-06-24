export class WebAuthnUtils {
  private static readonly LOCALHOST_RP_ID = "localhost";
  private static readonly LOCALHOST_RP_NAME = "Game server API";
  private static readonly LOCALHOST_ORIGIN = "http://localhost:5173";

  public static getRelyingPartyID(): string {
    return Deno.env.get("RP_ID") ?? this.LOCALHOST_RP_ID;
  }

  public static getRelyingPartyName(): string {
    return Deno.env.get("RP_NAME") ?? this.LOCALHOST_RP_NAME;
  }

  public static getRelyingPartyOrigin(): string {
    return Deno.env.get("RP_ORIGIN") ?? this.LOCALHOST_ORIGIN;
  }
}
