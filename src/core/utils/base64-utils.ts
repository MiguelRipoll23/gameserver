export class Base64Utils {
  public static encodeBase64URL(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    const base64 = btoa(binary);

    // Convert to Base64URL: replace +/ with -_, remove padding
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  public static decodeBase64URL(base64url: string): string {
    // Convert from Base64URL to standard Base64
    let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
    // Pad with '=' to make length a multiple of 4
    const pad = base64.length % 4;
    if (pad !== 0) {
      base64 += "=".repeat(4 - pad);
    }
    const binary = atob(base64);

    return binary;
  }
}
