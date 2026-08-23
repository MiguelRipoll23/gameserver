# Agents Coding Guidelines

## Project Overview

This is a **monorepo** containing two packages:

### Backend (`backend/`) — Game Server
Cloudflare Workers-based game server using:
- **Runtime:** Cloudflare Workers (KV, Durable Objects, Hyperdrive)
- **Framework:** Hono (with Zod OpenAPI)
- **Database:** PostgreSQL via `pg` driver, **Drizzle ORM**
- **Auth:** WebAuthn (passkeys) via `@simplewebauthn/server`
- **DI:** `@needle-di/core` (with decorators)
- **Validation:** Zod schemas (v4)
- **Deployment:** Cloudflare Workers

### Frontend (`frontend/`) — Management Console
React + TypeScript + Vite management dashboard using:
- **UI:** Cloudflare Kumo + Tailwind CSS
- **Routing:** TanStack Router
- **Data fetching:** TanStack React Query + openapi-fetch
- **API types:** Generated via `openapi-typescript` from the backend's OpenAPI schema
- **Linting:** Oxlint

## Workspace

- Package manager: **pnpm** (root `pnpm-workspace.yaml` defines both packages).
- Install dependencies from root: `pnpm install`.
- Scripts are run per-package: `cd backend && pnpm run dev` or `pnpm --filter gameserver dev`.

## TypeScript & Import Rules (Backend)

- **Do NOT use dynamic imports for types or interfaces.** Always use static imports at the top of the file.
- Use relative imports with `.ts` extensions (e.g., `../../db/schema.ts`).
- Barrel exports through `schema.ts` for all database tables.

## Environment & Bindings (Backend)

- Bindings are read directly via `import { env } from "cloudflare:workers"` — do not add wrapper helpers around `env`.
- Bindings: `GAMESERVER_KV` (KV), `HYPERDRIVE` (PostgreSQL via Hyperdrive), `WEBSOCKET_DURABLE_OBJECT` (WebSocket Durable Object).
- Local development reads a single gitignored `.env` (copy from `.env.example`): `DATABASE_URL` for migrations, and `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` for `pnpm run dev`.
- Regenerate `worker-configuration.d.ts` with `pnpm run cf-typegen` after changing `wrangler.jsonc`.

## Database & Drizzle ORM (Backend)

- Tables are defined in `src/db/tables/` as individual files, re-exported from `src/db/schema.ts`.
- Every table file exports two types:
  ```ts
  export type UserEntity = typeof usersTable.$inferSelect;
  export type UserInsertEntity = typeof usersTable.$inferInsert;
  ```
- Use `pgTable` from `drizzle-orm/pg-core`. Column names use `snake_case` in SQL.
- Foreign keys use `.references()` with `onDelete` cascade where appropriate.
- For migrations: `pnpm run db:generate` (creates SQL), then `pnpm run db:migrate` (applies via scripts/migrate-database.ts).
- **Row-Level Security (RLS):** Most tables define `pgPolicy` rules using `authenticatedUserRole` and helpers from `src/db/rls.ts`.

## API Structure (Backend)

- API is versioned under `src/api/versions/v1/`.
- Routers are split by access level: `public-router.ts`, `authenticated-router.ts`, `moderation-router.ts`, `management-router.ts`.
- All route handlers use `@hono/zod-openapi` for typed request/response validation and OpenAPI docs.
- Schemas use `z.object()` from `@hono/zod-openapi` with `.openapi({ example: ... })` metadata.
- Use `.describe()` on fields for documentation.

## DI Pattern (Backend)

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

## Error Handling (Backend)

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
- **Entity types:** PascalCase with `Entity` suffix (e.g., `UserEntity`)
- **Insert types:** PascalCase with `InsertEntity` suffix (e.g., `UserInsertEntity`)
- **Env vars and bindings:** `UPPER_SNAKE_CASE` (e.g., `JWT_SECRET`, `DATABASE_URL`)
- **Error codes:** `UPPER_SNAKE_CASE` (e.g., `MATCH_NOT_FOUND`)