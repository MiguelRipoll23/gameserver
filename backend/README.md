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

1. Configure the Worker variables and secrets listed in `.env.example` via the Cloudflare dashboard or `wrangler secret put`.
2. Create the resources declared in `wrangler.jsonc` and fill in their IDs for each environment (top-level, `staging`, and `production`):
   - `GAMESERVER_KV` — one KV namespace per environment.
   - `HYPERDRIVE` — one Hyperdrive configuration per environment (same binding name, different `id`).
   - `WEBSOCKET_DURABLE_OBJECT` — declared via `durable_objects`; no ID required.
3. Connect the Worker to the repository in the Cloudflare dashboard (Settings → Builds), set the build command to `pnpm run predeploy`, and keep the deploy command as `npx wrangler deploy`. Commit and push — Workers Builds runs predeploy (migrations + Discord registration) and deploys on every push.

### Database configuration

Provision a PostgreSQL database and create the `authenticated_user` role before running migrations. The deployed Worker connects through Cloudflare Hyperdrive, so the Worker itself never needs a `DATABASE_URL` secret — only the migration/CI commands (which run outside the Worker) connect to PostgreSQL directly.

#### Local configuration

Copy `.env.example` to `.env` and set:

- `DATABASE_URL` — used by the local migration commands (`pnpm run db:migrate` and `pnpm run predeploy`).
- `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` — used by `pnpm run dev` to emulate the `HYPERDRIVE` binding.

The `dev` script loads `.env` into the process environment, which is how Wrangler reads the local Hyperdrive connection string. The same variable works whether you run plain `pnpm run dev` or `--env staging`/`--env production`, because the binding name stays `HYPERDRIVE`.

#### CI/CD (staging and production)

Deployment runs through Cloudflare Workers Builds, which authenticates through the dashboard connection — no `CLOUDFLARE_API_TOKEN` is needed. Set the build command to `pnpm run predeploy` to apply migrations and register the Discord slash commands before each deploy, and keep the deploy command as `npx wrangler deploy`. For separate `staging` and `production` Workers, connect each environment's Worker and add `--env staging`/`--env production` to the deploy command.

Add `DATABASE_URL`, `DISCORD_APPLICATION_ID`, and `DISCORD_BOT_TOKEN` as build variables/secrets in the Workers Builds settings (Settings → Build). The build command runs on every push to the production branch (and on preview branches if enabled), so migrations run before each deploy.

To deploy the `staging` environment whenever a pull request is opened or updated, enable preview branches in Workers Builds and set the preview deploy command to `npx wrangler deploy --env staging`. Cloudflare authenticates through the dashboard connection, so all secrets stay in the Cloudflare dashboard — nothing needs to be stored in GitHub.

## Contributing

I welcome contributions of all kinds! Whether you're fixing bugs, adding new
features, improving documentation, or suggesting enhancements, your efforts are
appreciated.

Play, Create & Share
