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
- Anti-cheat rules with automatic violation reporting and temporary bans

## Configuration

The application runs on Cloudflare Workers, with `wrangler.jsonc` as the source of truth for the Worker's bindings.

1. Configure the Worker variables and secrets listed in `.env.example` via the Cloudflare dashboard or `wrangler secret put`.
2. Create the resources declared in `wrangler.jsonc` and fill in their IDs for each environment (top-level, `staging`, and `production`):
   - `GAMESERVER_KV` — one KV namespace per environment.
   - `HYPERDRIVE` — one Hyperdrive configuration per environment (same binding name, different `id`).
   - `WEBSOCKET_DURABLE_OBJECT` — declared via `durable_objects`; no ID required.
3. Commit and push. GitHub Actions deploys to `staging` on pull requests and to `production` on pushes to `main`.

### Database configuration

Provision a PostgreSQL database and create the `authenticated_user` role before running migrations. The deployed Worker connects through Cloudflare Hyperdrive, so the Worker itself never needs a `DATABASE_URL` secret — only the migration/CI commands (which run outside the Worker) connect to PostgreSQL directly.

#### Local configuration

Copy `.env.example` to `.env` and set:

- `DATABASE_URL` — used by the local migration commands (`pnpm run db:migrate` and `pnpm run predeploy`).
- `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` — used by `pnpm run dev` to emulate the `HYPERDRIVE` binding.

The `dev` script loads `.env` into the process environment, which is how Wrangler reads the local Hyperdrive connection string. The same variable works whether you run plain `pnpm run dev` or `--env staging`/`--env production`, because the binding name stays `HYPERDRIVE`.

#### CI/CD (staging and production)

In CI, the deploy workflow runs `wrangler deploy --env <target>` and `pnpm run predeploy` (which applies migrations and registers the Discord slash commands). Configure these secrets on the matching GitHub Actions environment (`staging` and `production`):

- `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` — used by `wrangler deploy`.
- `DATABASE_URL` — used by `pnpm run predeploy` to run migrations against the target database.
- `DISCORD_APPLICATION_ID` and `DISCORD_BOT_TOKEN` — used by `pnpm run predeploy` to register the Discord slash commands.

The reusable deploy workflow selects the environment with `environment: ${{ inputs.target }}`, so the job picks up the secrets for the target environment. Staging deploys on pull requests to `main`; production deploys on pushes to `main`.

## Contributing

I welcome contributions of all kinds! Whether you're fixing bugs, adding new
features, improving documentation, or suggesting enhancements, your efforts are
appreciated.

Play, Create & Share
