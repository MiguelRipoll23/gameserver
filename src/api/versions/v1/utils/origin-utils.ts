import type { Context } from "hono";

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
 * @throws Returns a 400 JSON response if the Origin header is missing
 */
export function extractAndValidateOrigin(c: Context): string | Response {
  const origin = extractOrigin(c);
  
  if (!origin) {
    return c.json({ error: "Missing Origin header" }, 400);
  }
  
  return origin;
}
