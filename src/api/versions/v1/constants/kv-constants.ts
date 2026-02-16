export const KV_VERSION = "version";
export const KV_SIGNATURE_KEYS = "signature_keys";
export const KV_REGISTRATION_OPTIONS = "registration_options";
export const KV_AUTHENTICATION_OPTIONS = "authentication_options";
export const KV_CONFIGURATION = "configuration";
export const KV_USER_KEYS = "user_keys";
export const KV_BANNED_USERS = "banned_users";

// Authentication token lifetime (seconds)
export const JWT_EXPIRATION_SECONDS = 24 * 60 * 60; // 1 day

// TTL for user symmetric keys stored in KV (milliseconds)
export const KV_USER_KEYS_EXPIRATION_TIME = JWT_EXPIRATION_SECONDS * 1000;

// Session lifetime (seconds) — keep in sync with JWT expiry
export const SESSION_LIFETIME_SECONDS = JWT_EXPIRATION_SECONDS;

export const KV_OPTIONS_EXPIRATION_TIME = 1 * 60 * 1000;
