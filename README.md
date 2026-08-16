# Game server

A game server for multiplayer peer-to-peer games.

Deploys to Cloudflare Workers with Cloudflare Hyperdrive for PostgreSQL connectivity.

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

## Configuration

The application runs on Cloudflare Workers. Before deploying:

1. Install the latest Node.js and run `pnpm install`.
2. Authenticate Wrangler with `npx wrangler login`, or provide `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
3. Configure the required Worker secrets with Wrangler, including `JWT_SECRET`, `RP_ALLOWED_ORIGINS`, and the Discord/Cloudflare Calls secrets when those features are enabled.
4. Configure the `HYPERDRIVE` binding in `wrangler.jsonc` — one binding name whose `id` differs per environment (top-level for local development, plus `staging` and `production` overrides).
5. Deploy with `pnpm run deploy:staging` or `pnpm run deploy:production`.

### Database configuration

The deployed Worker connects through Cloudflare Hyperdrive and does not require a `DATABASE_URL` Worker secret. `DATABASE_URL` is only needed by the local/CI migration commands (`pnpm run db:migrate` and `pnpm run predeploy`) because those commands run outside the Worker and connect directly to PostgreSQL.

Provision a PostgreSQL database and create the `authenticated_user` role before running migrations. Copy `.env.example` to `.env` and set `DATABASE_URL` (used by local/CI migrations) and `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` (used by `pnpm run dev` to emulate the Hyperdrive binding). The `dev` script loads `.env` into the process environment, which is how Wrangler reads the local Hyperdrive connection string. The same variable works whether you run plain `pnpm run dev` or `--env staging`/`--env production`, because the binding name stays `HYPERDRIVE`.

## Contributing

I welcome contributions of all kinds! Whether you're fixing bugs, adding new
features, improving documentation, or suggesting enhancements, your efforts are
appreciated.

Play, Create & Share
