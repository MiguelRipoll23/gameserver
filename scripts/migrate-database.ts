import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const DATABASE_URL_ENV = "DATABASE_URL";

export async function migrateDatabase(): Promise<void> {
  const databaseUrl = Deno.env.get(DATABASE_URL_ENV);

  if (!databaseUrl) {
    throw new Error(`${DATABASE_URL_ENV} environment variable is required`);
  }

  const databasePool = new Pool({
    connectionString: databaseUrl,
  });

  try {
    const database = drizzle(databasePool);

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

if (import.meta.main) {
  try {
    await migrateDatabase();
  } catch (error) {
    console.error(error);
    Deno.exit(1);
  }
}
