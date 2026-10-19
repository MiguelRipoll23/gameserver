import { AsyncLocalStorage } from "node:async_hooks";
import { Logger } from "../utils/logger.ts";
import { Client } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { ServerError } from "../../api/versions/v1/models/server-error.ts";
import { injectable } from "@needle-di/core";
import { sql } from "drizzle-orm/sql";
import { env } from "cloudflare:workers";
import { normalizeDatabaseConnectionString } from "../utils/connection-string-utils.ts";

/**
 * Request-scoped PostgreSQL access for Cloudflare Workers.
 *
 * Follows the official Hyperdrive + Drizzle ORM pattern: instead of caching a
 * global `pg.Pool` (whose pooled sockets can go stale across request contexts
 * and hang forever under pg's default infinite timeouts), a fresh `pg.Client`
 * is opened per request/operation and closed when it finishes. Hyperdrive does
 * the pooling at the edge, so the per-request connection is cheap, and the
 * explicit timeouts turn connection failures into logged errors instead of
 * silent hangs.
 *
 * The connection is scoped with AsyncLocalStorage, so services keep using the
 * synchronous `get()` without threading the client through every call site.
 */
@injectable()
export class DatabaseService {
  private static readonly CONNECTION_TIMEOUT_MS = 10_000;
  private static readonly QUERY_TIMEOUT_MS = 10_000;

  private static readonly requestStorage = new AsyncLocalStorage<NodePgDatabase>();

  /**
   * Runs `fn` with a fresh, request-scoped connection.
   *
   * The connection is opened before `fn` starts and closed (with errors logged)
   * after it settles. Every `get()` call made while `fn` runs returns the same
   * connection, so a request performs all of its queries on a single client.
   */
  public async withConnection<T>(fn: () => Promise<T>): Promise<T> {
    const hyperdrive = env.HYPERDRIVE;
    if (
      !hyperdrive ||
      typeof hyperdrive.connectionString !== "string" ||
      hyperdrive.connectionString.length === 0
    ) {
      throw new Error("HYPERDRIVE binding is not configured");
    }

    const client = new Client({
      connectionString: normalizeDatabaseConnectionString(
        hyperdrive.connectionString,
      ),
      connectionTimeoutMillis: DatabaseService.CONNECTION_TIMEOUT_MS,
      query_timeout: DatabaseService.QUERY_TIMEOUT_MS,
      statement_timeout: DatabaseService.QUERY_TIMEOUT_MS,
    });

    await client.connect();

    try {
      return await DatabaseService.requestStorage.run(
        drizzle({ client }),
        async () => {
          return await fn();
        },
      );
    } finally {
      await client.end().catch((error) => {
        Logger.error("[database] Failed to close connection:", error);
      });
    }
  }

  /**
   * Returns the database instance scoped to the current request/operation.
   *
   * @throws ServerError when no connection scope is active — callers must be
   *   reached from a `withConnection()` scope (HTTP handler, cron, WebSocket Durable Object).
   */
  public get(): NodePgDatabase {
    const database = DatabaseService.requestStorage.getStore();
    if (database === undefined) {
      throw new ServerError(
        "DATABASE_NOT_INITIALIZED",
        "Database is not available in this context (no active withConnection scope)",
        500,
      );
    }

    return database;
  }

  public executeWithCredentialAndUserContext<T>(
    credentialId: string,
    userId: string,
    fn: (tx: NodePgDatabase) => Promise<T>,
  ): Promise<T> {
    return this.get().transaction(async (tx) => {
      await tx.execute(sql.raw(`SET app.credential_id = '${credentialId}'`));
      await tx.execute(sql.raw(`SET app.user_id = '${userId}'`));

      return await fn(tx);
    });
  }

  public executeWithCredentialContext<T>(
    credentialId: string,
    fn: (tx: NodePgDatabase) => Promise<T>,
  ): Promise<T> {
    return this.get().transaction(async (tx) => {
      await tx.execute(sql.raw(`SET app.credential_id = '${credentialId}'`));

      return await fn(tx);
    });
  }

  public executeWithUserContext<T>(
    userId: string,
    fn: (tx: NodePgDatabase) => Promise<T>,
  ): Promise<T> {
    return this.get().transaction(async (tx) => {
      await tx.execute(sql.raw(`SET app.user_id = '${userId}'`));

      return await fn(tx);
    });
  }
}
