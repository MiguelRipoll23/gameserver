export const CACHE_EXCLUDED_PATHS = [
  "/",
  "/.well-known/openapi",
  // The manifest is request-dependent (the requesting origin is appended when
  // it matches an allowed pattern), so it must never be cached.
  "/.well-known/webauthn",
];
