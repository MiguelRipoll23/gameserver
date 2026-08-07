import type { Context } from "hono";
import type { ConnInfo } from "hono/conninfo";
import { ServerError } from "../models/server-error.ts";

/**
 * Resolves the client connection info for a request.
 *
 * On Cloudflare Workers the client IP is provided by the `CF-Connecting-IP`
 * header (this is what Hono's Deno `getConnInfo` helper resolved at runtime).
 */
export function getConnInfo(_c: Context): ConnInfo {
  const address = _c.req.header("CF-Connecting-IP") ?? "unknown";
  return { remote: { address } } as ConnInfo;
}

/**
 * Extracts and validates the origin from the request header
 * @param c - Hono context
 * @returns The origin header value or null if not present
 */
export function extractOrigin(c: Context): string | null {
  return c.req.header("Origin") ?? null;
}

/**
 * Validates that the origin header is present in the request
 * @param c - Hono context
 * @returns The origin header value
 * @throws Throws a 400 ServerError if the Origin header is missing
 */
export function extractAndValidateOrigin(c: Context): string {
  const origin = extractOrigin(c);

  if (!origin) {
    throw new ServerError("MISSING_ORIGIN", "Missing Origin header", 400);
  }

  return origin;
}
