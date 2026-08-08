# Agents Coding Guidelines

## Project Overview

This is a **Cloudflare Workers-based game server** using:
- **Runtime:** Cloudflare Workers (KV, Durable Objects, Hyperdrive)
- **Framework:** Hono (with Zod OpenAPI)
- **Database:** PostgreSQL via `pg` driver, **Drizzle ORM**
- **Auth:** WebAuthn (passkeys) via `@simplewebauthn/server`
- **DI:** `@needle-di/core` (with decorators)
- **Validation:** Zod schemas (v4)
- **Deployment:** Cloudflare Workers

## TypeScript & Import Rules

- **Do NOT use dynamic imports for types or interfaces.** Always use static imports at the top of the file.
- **Correct:**
  ```ts
  import { MyType } from "../types/my-type.ts";
  ```
- **Incorrect:**
  ```ts
  // ❌ Do not use dynamic import for types
  foo: import("../types/my-type.ts").MyType;
  ```
- Use relative imports with `.ts` extensions (e.g., `../../db/schema.ts`).
- Barrel exports through `schema.ts` for all database tables.

## Database & Drizzle ORM

- Tables are defined in `src/db/tables/` as individual files, re-exported from `src/db/schema.ts`.
- Every table file exports two types:
  ```ts
  export type UserEntity = typeof usersTable.$inferSelect;
  export type UserInsertEntity = typeof usersTable.$inferInsert;
  ```
- Use `pgTable` from `drizzle-orm/pg-core`. Column names use `snake_case` in SQL.
- Foreign keys use `.references()` with `onDelete` cascade where appropriate.
- For migrations: `npm run generate` (creates SQL), then `npm run migrate` (applies via scripts/migrate-database.ts). `DATABASE_URL` is required only by these local/CI migration commands; deployed Workers use the `DATABASE_HYPERDRIVE` binding.
- **Row-Level Security (RLS):** Most tables define `pgPolicy` rules using `authenticatedUserRole` and helpers from `src/db/rls.ts` (`isCurrentUser`, `isCurrentCredential`).

## API Structure

- API is versioned under `src/api/versions/v1/`.
- Routers are split by access level: `public-router.ts`, `authenticated-router.ts`, `moderation-router.ts`, `management-router.ts`.
- All route handlers use `@hono/zod-openapi` for typed request/response validation and OpenAPI docs.
- Schemas use `z.object()` from `@hono/zod-openapi` with `.openapi({ example: ... })` metadata.
- Use `.describe()` on fields for documentation.

## DI Pattern (@needle-di/core)

- Classes are decorated with `@injectable()` and use constructor injection:
  ```ts
  @injectable()
  export class MyService {
    constructor(
      private db = inject(DatabaseService),
    ) {}
  }
  ```
- All injectable dependencies are declared with `= inject(...)` default values.
- `compilerOptions.experimentalDecorators: true` is set in `tsconfig.json`.

## Error Handling

- Use `ServerError` (from `src/api/versions/v1/models/server-error.ts`) for all API errors:
  ```ts
  throw new ServerError("ERROR_CODE", "Human-readable message", statusCode);
  ```
- Error codes are `UPPER_SNAKE_CASE` strings.
- Global error handling is configured in `ErrorHandlingService`.

## Naming Conventions

- **Files:** `kebab-case.ts` (e.g., `matches-service.ts`, `users-table.ts`)
- **Classes:** PascalCase (e.g., `MatchesService`, `DatabaseService`)
- **Exports:** camelCase for table instances (e.g., `usersTable`, `matchesTable`)
- **Entity types:** PascalCase with `Entity` suffix (e.g., `UserEntity`, `MatchEntity`)
- **Insert types:** PascalCase with `InsertEntity` suffix (e.g., `UserInsertEntity`)
- **Env vars:** `UPPER_SNAKE_CASE` (e.g., `JWT_SECRET`, `DATABASE_HYPERDRIVE`)
- **Error codes:** `UPPER_SNAKE_CASE` (e.g., `MATCH_NOT_FOUND`)

## Environment Variables

Worker runtime configuration:
- `DATABASE_HYPERDRIVE` — Cloudflare Hyperdrive binding used for PostgreSQL connectivity
- `JWT_SECRET` — JWT signing secret
- `RP_ALLOWED_ORIGINS` — WebAuthn allowed origins (comma-separated, wildcard support)
- `CLOUDFLARE_CALLS_URL` / `CLOUDFLARE_CALLS_TOKEN` — Cloudflare Calls (WebRTC)

Migration-only configuration:
- `DATABASE_URL` — Direct PostgreSQL connection string used by local/CI migration commands, not by the deployed Worker

## Tasks & Scripts

| Task | Command | Purpose |
|---|---|---|
| `dev` | `npm run dev` | Start the Wrangler development server |
| `check` | `npm run check` | Type-check the project |
| `generate` | `npm run generate` | Generate Drizzle migrations from schema |
| `migrate` | `npm run migrate` | Apply pending migrations using `DATABASE_URL` |
| `predeploy` | `npm run predeploy` | Run migrations and register Discord commands |
| `deploy:staging` | `npm run deploy:staging` | Deploy to Cloudflare Workers staging |
| `deploy:production` | `npm run deploy:production` | Deploy to Cloudflare Workers production |

## Testing

(No test setup yet — add when introduced.)

## Git Workflow

- Only commit, amend, push, or create PRs when explicitly requested.
- Before committing, inspect `git status`, `git diff`, and `git log --oneline -10`.
- Write concise commit messages matching repo style.
- Do not force-push, use `-i`, or create empty commits.
