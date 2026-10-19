# Agents Coding Guidelines

## Project Overview

This repository is the **game server** for multiplayer peer-to-peer games. It is a
Cloudflare Workers app:

- **Runtime:** Cloudflare Workers (KV, Durable Objects, Hyperdrive)
- **Framework:** Hono (with Zod OpenAPI)
- **Database:** PostgreSQL via `pg` driver, **Drizzle ORM**
- **Auth:** WebAuthn (passkeys) via `@simplewebauthn/server`
- **DI:** `@needle-di/core` (with decorators)
- **Validation:** Zod schemas (v4)
- **Deployment:** Cloudflare Workers

The management console and its API live in a separate repository
(`gameserver-console`). This server only serves game clients.

## Workspace

- Package manager: **pnpm** (single package at the repository root).
- Install dependencies from the root: `pnpm install`.
- Scripts: `pnpm run dev`, `pnpm run typecheck`, `pnpm run cf-typegen`,
  `pnpm run db:generate`, `pnpm run db:migrate`, `pnpm run openapi:generate`.

## API Surface

- API is versioned under `src/api/versions/v1/`.
- Routers are split by access level: `public-router.ts`, `authenticated-router.ts`.
- Management/moderation endpoints are **not** part of this server. They live in
  the `gameserver-console` backend. If a game client needs data, add it here.
- Client-facing moderation kept here: `POST /user-moderation/manual-report`,
  `POST /user-moderation/automatic-report`, `GET /user-bans` (own ban status).
- `src/core/console-entrypoint.ts` exposes the `ConsoleEntrypoint` RPC surface
  the `gameserver-console` backend calls through a service binding for
  Worker-local actions (Durable Object kick/notification/cache refresh, KV
  configuration). It is re-exported from `src/main.ts`. Service bindings are only
  reachable from Workers on the same Cloudflare account, so these methods have no
  public route and no shared secret.
- All route handlers use `@hono/zod-openapi` for typed request/response
  validation and OpenAPI docs.

## TypeScript & Import Rules

- **Do NOT use dynamic imports for types or interfaces.** Always use static imports at the top of the file.
- Use relative imports with `.ts` extensions (e.g., `../../db/schema.ts`).
- Barrel exports through `schema.ts` for all database tables.

## Environment & Bindings

- Bindings are read directly via `import { env } from "cloudflare:workers"` — do not add wrapper helpers around `env`.
- Bindings: `GAMESERVER_KV` (KV), `HYPERDRIVE` (PostgreSQL via Hyperdrive), `WEBSOCKET_DURABLE_OBJECT` (WebSocket Durable Object).
- Local development reads a single gitignored `.env` (copy from `.env.example`): `DATABASE_URL` for migrations, and `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` for `pnpm run dev`.
- Regenerate `worker-configuration.d.ts` with `pnpm run cf-typegen` after changing `wrangler.jsonc`. Secrets that only exist at runtime are declared in `src/core/env-augment.d.ts`.

## Database & Drizzle ORM

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

## DI Pattern

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
- **Entity types:** PascalCase with `Entity` suffix (e.g., `UserEntity`)
- **Insert types:** PascalCase with `InsertEntity` suffix (e.g., `UserInsertEntity`)
- **Env vars and bindings:** `UPPER_SNAKE_CASE` (e.g., `JWT_SECRET`, `DATABASE_URL`)
- **Error codes:** `UPPER_SNAKE_CASE` (e.g., `MATCH_NOT_FOUND`)
