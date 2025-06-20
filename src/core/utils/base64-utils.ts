export class Base64Utils {
  public static arrayBufferToBase64Url(
    arrayBuffer: ArrayBuffer | ArrayBufferLike,
  ): string {
    const bytes = new Uint8Array(arrayBuffer);

    let binary = "";

    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  public static base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
    base64url = base64url.replace(/-/g, "+").replace(/_/g, "/");
    base64url += "=".repeat((4 - (base64url.length % 4)) % 4);

    const binary = atob(base64url);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    return bytes.buffer;
  }

  public static stringToBase64Url(str: string): string {
    return this.arrayBufferToBase64Url(new TextEncoder().encode(str).buffer);
  }

  public static base64UrlToString(base64url: string): string {
    return new TextDecoder().decode(this.base64UrlToArrayBuffer(base64url));
  }
}
