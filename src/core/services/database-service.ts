import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { ServerError } from "../../api/versions/v1/models/server-error.ts";

export class DatabaseService {
  private database: NodePgDatabase | null = null;

  public init(): void {
    const databaseUrl = Deno.env.get("DATABASE_URL");

    if (!databaseUrl) {
      throw new ServerError(
        "BAD_SERVER_CONFIGURATION",
        "Database URL is not set in environment variables",
        500
      );
    }

    this.database = drizzle(databaseUrl);
    console.log("Database connection opened");
  }

  public get(): NodePgDatabase {
    if (this.database === null) {
      throw new Error("Database not initialized");
    }

    return this.database;
  }
}
