# Game server

A game server for multiplayer peer-to-peer games.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/MiguelRipoll23/gameserver)

Used by these games:

- [Hood Ball - 2D Rocket League inspired-game](https://hoodball.vercel.app)
- [Air Combat - 3D flight combat simulator](https://aircombat.vercel.app)

## Features

- User registration and authentication using device authenticator
- Secure cloud-based game configuration to update game settings remotely
- Server messages and notifications for connected players
- Matchmaking using token-based pairing with tunneling support
- Player and host identity verification
- Chat messages integrity using digital signatures
- Secure player score management
- Discord bot for management and moderation
- Anti-cheat rules with automatic violation reporting

## Configuration

The application runs on Cloudflare Workers, with `wrangler.jsonc` as the source of truth for the Worker's bindings.

The Worker is deployed as a single `gameserver` Worker: top-level settings are production, and the `previews` block configures branch previews.

1. Configure the Worker variables and secrets listed in `.env.example` via the Cloudflare dashboard or `wrangler secret put`.
2. Create the resources declared in `wrangler.jsonc`:
   - Top level (production) — `GAMESERVER_KV` and `HYPERDRIVE`.
   - `previews` block — a separate `GAMESERVER_KV` namespace and `HYPERDRIVE` configuration (same binding names) pointing at a staging database.
   - `WEBSOCKET_DURABLE_OBJECT` — declared via `exports` and `durable_objects`; no ID required. Every preview gets its own Durable Object namespace and storage automatically.
3. Connect the Worker to the repository in the Cloudflare dashboard (Settings → Builds), set the deploy command to `pnpm run predeploy && npx wrangler deploy`, and enable Preview Builds with `npx wrangler preview` as the preview command. Commit and push — Workers Builds creates or updates a preview for every non-production branch and deploys `main` to production.
4. Set preview secrets once for every new preview, since previews do not inherit production secrets:
   ```sh
   npx wrangler preview base-config secret put JWT_SECRET
   npx wrangler preview base-config secret put DISCORD_BOT_TOKEN
   npx wrangler preview base-config secret put DISCORD_PUBLIC_KEY
   ```

### Database configuration

Provision a PostgreSQL database and create the `authenticated_user` role before running migrations. The deployed Worker connects through Cloudflare Hyperdrive, so the Worker itself never needs a `DATABASE_URL` secret — only the migration/CI commands (which run outside the Worker) connect to PostgreSQL directly.

#### Local configuration

Copy `.env.example` to `.env` and set:

- `DATABASE_URL` — used by the local migration commands (`pnpm run db:migrate` and `pnpm run predeploy`).
- `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` — used by `pnpm run dev` to emulate the `HYPERDRIVE` binding.

The `dev` script loads `.env` into the process environment, which is how Wrangler reads the local Hyperdrive connection string. The binding name stays `HYPERDRIVE` for production and previews, so the same variable works in every context.

#### CI/CD (production and preview builds)

Deployment runs through Cloudflare Workers Builds, which authenticates through the dashboard connection — no `CLOUDFLARE_API_TOKEN` is needed.

- Deploy command: `pnpm run predeploy && npx wrangler deploy`. Migrations and Discord slash-command registration run before each production deploy.
- Preview command: `npx wrangler preview` (enable Preview Builds in Settings → Build). Every push to a non-production branch creates or updates that branch's preview and comments its URL on the pull request.

Add `DATABASE_URL`, `DISCORD_APPLICATION_ID`, and `DISCORD_BOT_TOKEN` as build variables/secrets in the Workers Builds settings (Settings → Build). Preview builds share the same build variables, but because migrations live in the deploy command they only run for production deploys. Apply migrations to the staging database used by the previews separately: `DATABASE_URL=<staging-url> pnpm run db:migrate`.

Previews do not inherit production settings. Their KV and Hyperdrive bindings come from the `previews` block, and their secrets come from the Previews Base configuration or `npx wrangler preview secret put <NAME> --name <preview>`. Cron Triggers and routes only run in production, so the nightly cleanup job does not run in previews. Delete a preview branch with `npx wrangler preview delete --name <branch>`.

All secrets stay in the Cloudflare dashboard — nothing needs to be stored in GitHub.

## Contributing

I welcome contributions of all kinds! Whether you're fixing bugs, adding new
features, improving documentation, or suggesting enhancements, your efforts are
appreciated.

Play, Create & Share
