export class CryptoUtils {
  public static async base64ToCryptoKey(
    key: string,
    algorithm:
      | HmacImportParams
      | AlgorithmIdentifier
      | RsaHashedImportParams
      | EcKeyImportParams,
    keyUsages: KeyUsage[]
  ): Promise<CryptoKey> {
    const rawKey = Uint8Array.from(atob(key), (char) => char.charCodeAt(0));

    return await crypto.subtle.importKey(
      "raw",
      rawKey,
      algorithm,
      true,
      keyUsages
    );
  }

  /**
   * Converts a UUID string to an unformatted 32-byte representation (hex string without dashes).
   * @param uuid UUID string in format "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
   * @returns Uint8Array of 32 bytes representing the UUID as hex characters
   */
  public static uuidToUnformattedBytes(uuid: string): Uint8Array {
    // Remove dashes from UUID
    const unformatted = uuid.replace(/-/g, "");
    
    // Convert to bytes (each character is a byte)
    const encoder = new TextEncoder();
    return encoder.encode(unformatted);
  }
}
