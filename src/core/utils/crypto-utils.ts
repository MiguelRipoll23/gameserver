export class CryptoUtils {
  public static async base64ToCryptoKey(
    key: string,
    algorithm:
      | HmacImportParams
      | AlgorithmIdentifier
      | RsaHashedImportParams
      | EcKeyImportParams,
    keyUsages: KeyUsage[],
  ): Promise<CryptoKey> {
    const rawKey = Uint8Array.from(atob(key), (char) => char.charCodeAt(0));

    return await crypto.subtle.importKey(
      "raw",
      rawKey,
      algorithm,
      true,
      keyUsages,
    );
  }
}
