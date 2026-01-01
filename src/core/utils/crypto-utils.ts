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
   * Converts a UUID string to an unformatted 32-byte ASCII representation.
   * The UUID dashes are removed and the resulting 32-character hex string is encoded as UTF-8.
   * This is the format expected by the WebSocket protocol for user IDs.
   * @param uuid UUID string in format "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
   * @returns Uint8Array of 32 bytes representing the ASCII-encoded UUID hex string (without dashes)
   */
  public static uuidToUnformattedBytes(uuid: string): Uint8Array {
    // Remove dashes from UUID
    const unformatted = uuid.replace(/-/g, "");
    
    if (unformatted.length !== 32) {
      throw new Error(
        `Invalid UUID format: expected 32 hex characters after removing dashes, got ${unformatted.length}`
      );
    }
    
    // Validate that all characters are valid hexadecimal
    if (!/^[0-9a-fA-F]{32}$/.test(unformatted)) {
      throw new Error(
        `Invalid UUID format: UUID contains non-hexadecimal characters`
      );
    }
    
    // Convert to bytes (each character is a byte)
    const encoder = new TextEncoder();
    return encoder.encode(unformatted);
  }
}
