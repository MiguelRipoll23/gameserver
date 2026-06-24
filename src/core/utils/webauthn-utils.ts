export class WebAuthnUtils {
  private static readonly DEFAULT_RP_NAME = "Game server API";
  private static readonly DEFAULT_ALLOWED_ORIGINS = "http://localhost:8000";

  /**
   * Gets the relying party name from environment variable or uses default
   */
  public static getRelyingPartyName(rpName?: string): string {
    return rpName ?? WebAuthnUtils.DEFAULT_RP_NAME;
  }

  /**
   * Validates if the given origin matches any of the allowed origin patterns
   * @param origin - The origin to validate (e.g., "https://example.com")
   * @param allowedOriginsEnv - The RP_ALLOWED_ORIGINS env value (comma-separated)
   * @returns true if the origin is allowed, false otherwise
   */
  public static isOriginAllowed(
    origin: string,
    allowedOriginsEnv?: string,
  ): boolean {
    // Input validation
    if (typeof origin !== "string" || origin.trim().length === 0) {
      return false;
    }

    const patterns = WebAuthnUtils.parseAllowedOriginPatterns(allowedOriginsEnv);

    // Check if origin matches any pattern
    for (const pattern of patterns) {
      if (WebAuthnUtils.matchesPattern(origin, pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Parses the allowed origin patterns from environment variable value
   * @returns Array of origin patterns
   */
  public static parseAllowedOriginPatterns(
    allowedOriginsEnv?: string,
  ): string[] {
    const allowedOrigins =
      allowedOriginsEnv ?? WebAuthnUtils.DEFAULT_ALLOWED_ORIGINS;

    return allowedOrigins
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }

  /**
   * Extracts the relying party ID (hostname) from the given origin
   * @param origin - The origin to extract from (e.g., "https://example.com:8080")
   * @returns The hostname (e.g., "example.com")
   */
  public static getRelyingPartyIDFromOrigin(origin: string): string {
    try {
      const url = new URL(origin);
      return url.hostname;
    } catch {
      throw new Error("Invalid origin format");
    }
  }

  /**
   * Matches an origin against a pattern (supports wildcards)
   * Uses string-based matching instead of regex to avoid potential DoS attacks
   * @param origin - The origin to test
   * @param pattern - The pattern to match against (can include wildcards like *.example.com)
   * @returns true if the origin matches the pattern
   */
  private static matchesPattern(origin: string, pattern: string): boolean {
    // Direct match
    if (origin === pattern) {
      return true;
    }

    // Wildcard pattern matching using string operations
    if (pattern.includes("*")) {
      const parts = pattern.split("*");
      const first = parts[0] ?? "";
      const last = parts[parts.length - 1] ?? "";

      // Check prefix
      if (first && !origin.startsWith(first)) {
        return false;
      }

      // Check suffix
      if (last && !origin.endsWith(last)) {
        return false;
      }

      // Check middle parts
      let idx = first.length;
      for (const part of parts.slice(1, -1)) {
        if (!part) continue;
        const next = origin.indexOf(part, idx);
        if (next === -1) {
          return false;
        }
        idx = next + part.length;
      }

      return true;
    }

    return false;
  }
}
