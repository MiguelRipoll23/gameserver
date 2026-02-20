export const KV_VERSION = "version";
export const KV_SIGNATURE_KEYS = "signature_keys";
export const KV_REGISTRATION_OPTIONS = "registration_options";
export const KV_AUTHENTICATION_OPTIONS = "authentication_options";
export const KV_CONFIGURATION = "configuration";
export const KV_USER_KEYS = "user_keys";
export const KV_BANNED_USERS = "banned_users";
export const KV_REFRESH_TOKENS = "refresh_tokens";
export const KV_REFRESH_TOKEN_VERSIONS = "refresh_token_versions";

// Access token lifetime (seconds)
export const ACCESS_TOKEN_EXPIRATION_SECONDS = 30 * 60; // 30 minutes

// Refresh token lifetime (seconds)
export const REFRESH_TOKEN_EXPIRATION_SECONDS = 30 * 24 * 60 * 60; // 30 days

// TTL for user symmetric keys stored in KV (milliseconds)
export const KV_USER_KEYS_EXPIRATION_TIME = REFRESH_TOKEN_EXPIRATION_SECONDS * 1000;

// Session lifetime (seconds) — keep in sync with refresh token expiry
export const SESSION_LIFETIME_SECONDS = REFRESH_TOKEN_EXPIRATION_SECONDS;

export const KV_OPTIONS_EXPIRATION_TIME = 1 * 60 * 1000;
