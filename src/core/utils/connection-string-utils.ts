/**
 * Normalizes a PostgreSQL connection string for use with node-postgres.
 *
 * Neon pooler connection strings commonly include `channel_binding=require`,
 * which forces SCRAM-SHA-256-PLUS channel binding. node-postgres (and some
 * poolers) do not complete that handshake reliably, causing the connection to
 * hang and time out. Removing the parameter lets the driver fall back to
 * regular SCRAM authentication.
 */
export function normalizeDatabaseConnectionString(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete("channel_binding");
    return parsed.toString();
  } catch {
    return url.replace(/[?&]channel_binding=require/g, "");
  }
}
