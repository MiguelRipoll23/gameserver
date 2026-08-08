import { env } from "cloudflare:workers";
import { normalizeDatabaseConnectionString } from "./connection-string-utils.ts";

/**
 * Central helpers for reading Cloudflare Workers environment bindings.
 *
 * Bindings are accessed directly via `import { env } from "cloudflare:workers"`,
 * which works anywhere in the codebase — including code running outside HTTP
 * handlers (for example the Durable Object isolate).
 */

/**
 * Resolves the PostgreSQL connection string used by the database layer.
 *
 * Prefers the Hyperdrive binding (Neon + Cloudflare Hyperdrive); falls back to
 * the plain `DATABASE_URL` variable for local development, which runs without
 * a Hyperdrive resource.
 */
export function getDatabaseConnectionString(): string {
  const hyperdrive = env.DATABASE_HYPERDRIVE;
  if (
    hyperdrive &&
    typeof hyperdrive.connectionString === "string" &&
    hyperdrive.connectionString.length > 0
  ) {
    return hyperdrive.connectionString;
  }

  const url = env.DATABASE_URL;
  if (typeof url === "string" && url.length > 0) {
    return normalizeDatabaseConnectionString(url);
  }

  throw new Error(
    "No database connection string is configured (DATABASE_HYPERDRIVE binding or DATABASE_URL)",
  );
}

const WEBSOCKET_DURABLE_OBJECT_NAME = "websocket-durable-object";

export function getKvBinding<T extends KVNamespace>(name: string): T {
  const binding = (env as unknown as Record<string, unknown>)[name];
  if (binding === undefined) {
    throw new Error(`KV binding is not configured: ${name}`);
  }

  return binding as T;
}

/**
 * Returns a stub to the single WebSocketDurableObject instance, which owns all
 * WebSocket connections. RPC methods on it can be invoked directly.
 */
export function getHubStub() {
  const hub = env.WEBSOCKET_V1_DO;
  return hub.get(hub.idFromName(WEBSOCKET_DURABLE_OBJECT_NAME));
}
