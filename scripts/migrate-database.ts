import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { pathToFileURL } from "node:url";
import { normalizeDatabaseConnectionString } from "../src/core/utils/connection-string-utils.ts";

const DATABASE_URL_ENV = "DATABASE_URL";

export async function migrateDatabase(): Promise<void> {
  const rawDatabaseUrl = process.env[DATABASE_URL_ENV];

  if (!rawDatabaseUrl) {
    throw new Error(`${DATABASE_URL_ENV} environment variable is required`);
  }

  const databaseUrl = normalizeDatabaseConnectionString(rawDatabaseUrl);

  const databasePool = new Pool({
    connectionString: databaseUrl,
  });

  try {
    const database = drizzle({ client: databasePool });

    console.log("Running database migrations");
    await migrate(database, { migrationsFolder: "drizzle" });
    console.log("Database migrations completed");
  } catch (error) {
    console.error("Database migration failed");
    throw error;
  } finally {
    await databasePool.end();
  }
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  migrateDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
