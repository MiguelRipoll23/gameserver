import { OpenAPIHono } from "@hono/zod-openapi";
import { HonoVariables } from "../types/hono-variables-type.ts";
import { WebAuthnUtils } from "../utils/webauthn-utils.ts";

/**
 * Serves the WebAuthn Relying Party manifest at `/.well-known/webauthn` as
 * defined by the W3C WebAuthn Level 3 specification. The manifest lists the
 * concrete origins the relying party uses, sourced from the
 * `RP_ALLOWED_ORIGINS` environment variable. When the requesting origin
 * matches an allowed pattern (including wildcards), it is appended to the
 * list so wildcard patterns resolve to complete origins instead of being
 * discarded.
 */
export class WebAuthnService {
  public static configure(
    app: OpenAPIHono<{ Variables: HonoVariables }>,
  ): void {
    app.get("/.well-known/webauthn", (c) => {
      const requestOrigin = new URL(c.req.url).origin;

      return c.json(
        {
          origins: WebAuthnUtils.getManifestOrigins(requestOrigin),
        },
        200,
        {
          // Origins can change when RP_ALLOWED_ORIGINS is updated, so the
          // manifest must not be served from a stale cache.
          "Cache-Control": "no-store",
          // The manifest is fetched cross-origin with CORS by browsers when
          // validating a WebAuthn RP ID (e.g. the console running on
          // http://localhost:5173), so it must be readable from any origin.
          "Access-Control-Allow-Origin": "*",
        },
      );
    });
  }
}
