import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { ServerError } from "../../api/versions/v1/models/server-error.ts";
import { inject, injectable } from "@needle-di/core";
import { EnvService } from "./env-service.ts";
import { sql } from "drizzle-orm/sql";

@injectable()
export class DatabaseService {
  private database: NodePgDatabase | null = null;

  constructor(private envService = inject(EnvService)) {}

  public init(): void {
    const hyperdrive = this.envService.get<{ connectionString: string }>("HYPERDRIVE");

    if (!hyperdrive?.connectionString) {
      throw new ServerError(
        "BAD_SERVER_CONFIGURATION",
        "Hyperdrive database connection is not configured",
        500
      );
    }

    const pool = new Pool({ connectionString: hyperdrive.connectionString });
    this.database = drizzle({ client: pool });
    console.log("Database connection opened");
  }

  public get(): NodePgDatabase {
    if (this.database === null) {
      throw new ServerError(
        "DATABASE_NOT_INITIALIZED",
        "Database has not been initialized",
        500
      );
    }

    return this.database;
  }

  public executeWithCredentialAndUserContext<T>(
    credentialId: string,
    userId: string,
    fn: (tx: NodePgDatabase) => Promise<T>
  ): Promise<T> {
    return this.get().transaction(async (tx) => {
      await tx.execute(sql.raw(`SET app.credential_id = '${credentialId}'`));
      await tx.execute(sql.raw(`SET app.user_id = '${userId}'`));

      return await fn(tx);
    });
  }

  public executeWithCredentialContext<T>(
    credentialId: string,
    fn: (tx: NodePgDatabase) => Promise<T>
  ): Promise<T> {
    return this.get().transaction(async (tx) => {
      await tx.execute(sql.raw(`SET app.credential_id = '${credentialId}'`));

      return await fn(tx);
    });
  }

  public executeWithUserContext<T>(
    userId: string,
    fn: (tx: NodePgDatabase) => Promise<T>
  ): Promise<T> {
    return this.get().transaction(async (tx) => {
      await tx.execute(sql.raw(`SET app.user_id = '${userId}'`));

      return await fn(tx);
    });
  }
}
