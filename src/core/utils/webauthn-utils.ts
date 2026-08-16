import { env } from "cloudflare:workers";

export class WebAuthnUtils {
  private static readonly DEFAULT_RP_NAME = "Game server";
  private static readonly DEFAULT_RP_ID = "localhost";
  private static readonly DEFAULT_ALLOWED_ORIGINS = "http://localhost:8000";
  private static cachedPatterns: string[] | null = null;
  private static cachedAllowedOrigins: string | null = null;

  /**
   * Gets the relying party name from environment variable or uses default
   */
  public static getRelyingPartyName(): string {
    return env.RP_NAME ?? WebAuthnUtils.DEFAULT_RP_NAME;
  }

  /**
   * Gets the relying party ID from environment variable or uses default
   * @returns The relying party ID (e.g., "example.com")
   */
  public static getRelyingPartyID(): string {
    return env.RP_ID ?? WebAuthnUtils.DEFAULT_RP_ID;
  }

  /**
   * Gets the origins to serve on the WebAuthn Relying Party manifest
   * (`/.well-known/webauthn`). Starts with the concrete origins configured in
   * `RP_ALLOWED_ORIGINS` and, when the requesting origin matches an allowed
   * pattern (including wildcards), appends the complete requesting origin so
   * wildcard patterns are not discarded.
   * @param requestOrigin - The origin of the request (e.g., "https://example.com")
   * @returns Array of concrete origins (e.g., ["https://example.com", "https://sub.example.com"])
   */
  public static getManifestOrigins(requestOrigin: string): string[] {
    const origins = WebAuthnUtils.getAllowedOrigins();

    if (
      WebAuthnUtils.isOriginAllowed(requestOrigin) &&
      !origins.includes(requestOrigin)
    ) {
      origins.push(requestOrigin);
    }

    return origins;
  }

  /**
   * Validates if the given origin matches any of the allowed origin patterns
   * @param origin - The origin to validate (e.g., "https://example.com")
   * @returns true if the origin is allowed, false otherwise
   */
  public static isOriginAllowed(origin: string): boolean {
    // Input validation
    if (typeof origin !== "string" || origin.trim().length === 0) {
      return false;
    }

    const patterns = WebAuthnUtils.getAllowedOriginPatterns();

    // Check if origin matches any pattern
    for (const pattern of patterns) {
      if (WebAuthnUtils.matchesPattern(origin, pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Gets the concrete allowed origins for the WebAuthn Relying Party manifest
   * (`/.well-known/webauthn`). Only fully-qualified origins are included:
   * wildcard patterns and malformed values are excluded because the manifest
   * only accepts valid web origins.
   * @returns Array of concrete origins (e.g., "https://example.com")
   */
  public static getAllowedOrigins(): string[] {
    return WebAuthnUtils.getAllowedOriginPatterns().filter((pattern) => {
      if (pattern.includes("*")) {
        return false;
      }

      try {
        const url = new URL(pattern);
        return (
          (url.protocol === "http:" || url.protocol === "https:") &&
          url.hostname.length > 0
        );
      } catch {
        return false;
      }
    });
  }

  /**
   * Gets and caches the allowed origin patterns from environment variable
   * @returns Array of origin patterns
   */
  private static getAllowedOriginPatterns(): string[] {
    const allowedOrigins = env.RP_ALLOWED_ORIGINS ??
      WebAuthnUtils.DEFAULT_ALLOWED_ORIGINS;

    // Return cached patterns if the env var hasn't changed
    if (
      WebAuthnUtils.cachedAllowedOrigins === allowedOrigins &&
      WebAuthnUtils.cachedPatterns !== null
    ) {
      return WebAuthnUtils.cachedPatterns;
    }

    // Parse and cache the patterns, filtering out empty strings
    WebAuthnUtils.cachedAllowedOrigins = allowedOrigins;
    WebAuthnUtils.cachedPatterns = allowedOrigins
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    return WebAuthnUtils.cachedPatterns;
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
