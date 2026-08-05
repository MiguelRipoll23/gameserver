// Access token lifetime (seconds)
export const ACCESS_TOKEN_EXPIRATION_SECONDS = 30 * 60; // 30 minutes

// Refresh token lifetime (seconds)
export const REFRESH_TOKEN_EXPIRATION_SECONDS = 30 * 24 * 60 * 60; // 30 days

// Session lifetime (seconds) — keep in sync with refresh token expiry
export const SESSION_LIFETIME_SECONDS = REFRESH_TOKEN_EXPIRATION_SECONDS;

// Authentication/registration WebAuthn options TTL (ms)
export const OPTIONS_EXPIRATION_TIME = 1 * 60 * 1000;
