# Database Branching with Neon + Cloudflare Workers

## Overview

Every Git branch gets its own isolated Neon database branch, fronted by a dedicated Cloudflare Hyperdrive config — provisioned automatically on every push. Three environments: development (local), preview (per-branch), production (main).

## Architecture

```
┌──────────────┐     push to main     ┌─────────────────┐
│   GitHub     │ ──────────────────→  │ Workers Builds  │
│   (source)   │                      │ (CI/CD trigger) │
│              │     push to PR       │                 │
│              │ ──────────────────→  │                 │
└──────────────┘                      └────────┬────────┘
                                               │
                                               ▼
                                    ┌─────────────────────┐
                                    │  scripts/deploy.ts   │
                                    │  (single entry point)│
                                    └──────┬──────────┬───┘
                                           │          │
                              ┌────────────┘          └────────────┐
                              ▼                                   ▼
                   ┌──────────────────┐              ┌──────────────────────┐
                   │ Production flow  │              │   Preview flow       │
                   │ (default branch) │              │ (non-default branch) │
                   └────────┬─────────┘              └──────────┬───────────┘
                            │                                    │
                            ▼                                    ▼
                   ┌──────────────────┐              ┌──────────────────────┐
                   │ 1. Use Neon's    │              │ 1. Create/reuse Neon │
                   │    default branch │              │    branch preview-*  │
                   │ 2. Upsert        │              │ 2. Upsert Hyperdrive │
                   │    Hyperdrive    │              │    per branch        │
                   │ 3. Run migrations│              │ 3. Run migrations    │
                   │ 4. wrangler      │              │ 4. wrangler versions │
                   │    deploy        │              │    upload --preview  │
                   └──────────────────┘              └──────────────────────┘
```

## Components

### `scripts/deploy.ts`
Single deploy script, run by Workers Builds on every push. Branches on `WORKERS_CI_BRANCH`:
- **Production** (`main`): Uses Neon's default branch, upserts `gameserver--production` Hyperdrive config, runs `wrangler deploy`.
- **Preview** (non-main): Creates/reuses a `preview-<slug>` Neon branch (7-day TTL), upserts a per-branch Hyperdrive config, runs `wrangler versions upload --preview-alias <slug>`.

### `scripts/pre-deploy.ts`
Optional hook invoked after Neon branch provisioning but before Worker deploy. Receives `DATABASE_URL` (pooled), `DATABASE_URL_UNPOOLED` (direct), `NEON_BRANCH_ID`, `NEON_BRANCH_NAME`, and `DEPLOY_ENV`. Runs Drizzle migrations against the fresh branch.

### `wrangler.jsonc`
Converted from `wrangler.toml` — JSONC format (Cloudflare recommended). Hyperdrive ID is a placeholder; the deploy script injects the correct ID via a temp config file.

## Data Flow

1. **Push to GitHub** → Cloudflare Workers Builds triggers
2. **Workers Builds** sets `WORKERS_CI_BRANCH`, `WORKERS_CI_BUILD_UUID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
3. **scripts/deploy.ts** determines production vs preview
4. **Neon API** → create/find branch, fetch connection URIs
5. **Cloudflare API** → create/update Hyperdrive config
6. **Pre-deploy hook** → run migrations via `scripts/migrate.ts`
7. **Wrangler** → deploy with Hyperdrive binding + `DATABASE_URL` / `DATABASE_URL_UNPOOLED` as secrets

## State Management

- **Neon branch lifecycle**: TTL-based (7 days), refreshed on every push. Data persists across commits on the same branch. No automatic rollback on force-push.
- **Hyperdrive configs**: Created per branch. Orphaned configs (whose Neon branch no longer exists) are cleaned up at the start of each deploy.
- **Local dev**: Uses a shared `dev` Neon branch via `.env` file.

## Environment Variables

| Variable | Where set | Purpose |
|---|---|---|
| `NEON_API_KEY` | Cloudflare dashboard (secret) | Neon API authentication |
| `NEON_PROJECT_ID` | Cloudflare dashboard (text) | Neon project identifier |
| `GIT_DEFAULT_BRANCH` | Cloudflare dashboard (text) | Default branch name (default: `main`) |

Auto-injected by Workers Builds: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `WORKERS_CI_BRANCH`, `WORKERS_CI_BUILD_UUID`.

## Worker Changes

- **`DatabaseService`**: Unchanged — reads `HYPERDRIVE` binding as before. The binding points to the correct branch automatically.
- **`Env` type**: Updated to include `DATABASE_URL_UNPOOLED` for local dev.
- **`scripts/migrate.ts`**: Updated to prefer `DATABASE_URL_UNPOOLED` for DDL safety.

## Setup Steps

1. Install the [Cloudflare Workers and Pages GitHub App](https://github.com/apps/cloudflare-workers-and-pages) on the repo.
2. Create a Neon project (free tier).
3. Generate a Neon API key.
4. In Cloudflare dashboard → Worker → Settings → Build:
   - Build command: `npm ci`
   - Deploy command: `npx tsx scripts/deploy.ts`
   - Non-production branch deploy command: `npx tsx scripts/deploy.ts`
5. Add environment variables: `NEON_API_KEY` (secret), `NEON_PROJECT_ID` (text), `GIT_DEFAULT_BRANCH` (text).
6. Set `placement.region` in `wrangler.jsonc` to match the Neon project region.
7. First deploy triggers on push to `main`.
