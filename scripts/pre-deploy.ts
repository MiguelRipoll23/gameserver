import { execSync } from "node:child_process";

const databaseUrl = process.env["DATABASE_URL_UNPOOLED"] ?? process.env["DATABASE_URL"];

if (!databaseUrl) {
  console.error("DATABASE_URL_UNPOOLED or DATABASE_URL is required");
  process.exit(1);
}

console.log("Running database migrations against branch...");

try {
  execSync("npx tsx scripts/migrate.ts", {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
  });
} catch {
  console.error("Migration failed");
  process.exit(1);
}

console.log("Database migrations completed");
