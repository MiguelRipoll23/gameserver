import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const DATABASE_URL_ENV = "DATABASE_URL";

const databaseUrl = Deno.env.get(DATABASE_URL_ENV);

if (!databaseUrl) {
  console.error(`${DATABASE_URL_ENV} environment variable is required`);
  Deno.exit(1);
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
  console.error(error);
  Deno.exit(1);
} finally {
  await databasePool.end();
}
