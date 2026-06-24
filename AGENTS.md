# Agents Coding Guidelines

## Project Overview

This is a **Node.js game server for Cloudflare Workers** using:
- **Runtime:** Cloudflare Workers (Durable Objects, WebSocket)
- **Framework:** Hono (with Zod OpenAPI)
- **Database:** PostgreSQL via `pg` driver, **Drizzle ORM**
- **Auth:** WebAuthn (passkeys) via `@simplewebauthn/server`
- **DI:** `@needle-di/core` (with decorators)
- **Validation:** Zod schemas (v4)
- **Deployment:** Cloudflare Workers via Wrangler

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
- For migrations: `deno task generate` (creates SQL), then `deno task migrate` (applies via scripts/migrate.ts).
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
- `compilerOptions.experimentalDecorators: true` is set in tsconfig.json.

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
- **Env vars:** `UPPER_SNAKE_CASE` (e.g., `DATABASE_URL`, `JWT_SECRET`)
- **Error codes:** `UPPER_SNAKE_CASE` (e.g., `MATCH_NOT_FOUND`)

## Environment Variables

All required env vars (see `.env.example`):
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — JWT signing secret
- `RP_ALLOWED_ORIGINS` — WebAuthn allowed origins (comma-separated, wildcard support)
- `CLOUDFLARE_CALLS_URL` / `CLOUDFLARE_CALLS_TOKEN` — Cloudflare Calls (WebRTC)

## Database Branching

Branch-aware deployments via `scripts/deploy.ts`, triggered by **Cloudflare Workers Builds** (GitHub App).

- **Production** (`main` branch): uses Neon's default branch, upserts `gameserver--production` Hyperdrive config.
- **Preview** (any other branch): creates/reuses a `preview-<slug>` Neon branch (7-day TTL), upserts a per-branch Hyperdrive config, deploys as a preview version.

### Flow
1. Push to GitHub → Workers Builds triggers.
2. `scripts/deploy.ts` runs. It checks `WORKERS_CI_BRANCH` to determine production vs preview.
3. Neon branch is created/found, Hyperdrive config is provisioned.
4. `scripts/pre-deploy.ts` runs migrations against the new branch.
5. Worker is deployed (production) or uploaded as preview version.

### Setup
1. Install [Cloudflare Workers and Pages GitHub App](https://github.com/apps/cloudflare-workers-and-pages) on the repo.
2. In Cloudflare dashboard → Worker → Settings → Build:
   - Build command: `npm ci`
   - Deploy command: `npx tsx scripts/deploy.ts`
   - Non-production branch deploy command: `npx tsx scripts/deploy.ts`
3. Add to Worker's build environment variables:
   - `NEON_API_KEY` (secret) — from Neon dashboard
   - `NEON_PROJECT_ID` (text) — from Neon dashboard
   - `GIT_DEFAULT_BRANCH` (text) — defaults to `main`

### Local Development
- Create a `dev` branch in your Neon project.
- Set `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` in `.env`.

## Tasks & Scripts

| Task | Command | Purpose |
|---|---|---|
| `dev` | `npm run dev` | Dev server with `wrangler dev` |
| `check` | `npx tsc --noEmit` | Type-check the project |
| `generate` | `npx drizzle-kit generate` | Generate Drizzle migrations from schema |
| `migrate` | `npx tsx scripts/migrate.ts` | Apply pending migrations |
| `studio` | `npx drizzle-kit studio` | Open Drizzle Studio |
| `deploy` | `npx wrangler deploy` | Deploy to Cloudflare Workers (uses current config) |
| `deploy:production` | `npx tsx scripts/deploy.ts` | Production deploy via deploy script |

## Testing

(No test setup yet — add when introduced.)

## Git Workflow

- Only commit, amend, push, or create PRs when explicitly requested.
- Before committing, inspect `git status`, `git diff`, and `git log --oneline -10`.
- Write concise commit messages matching repo style.
- Do not force-push, use `-i`, or create empty commits.
