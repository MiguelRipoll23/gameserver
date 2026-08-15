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

1. Install Node.js and run `npm ci`.
2. Authenticate Wrangler with `npx wrangler login`, or provide `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
3. Configure the required Worker secrets with Wrangler, including `JWT_SECRET`, `RP_ALLOWED_ORIGINS`, and the Discord/Cloudflare Calls secrets when those features are enabled.
4. Configure the `DATABASE_HYPERDRIVE` binding in `wrangler.jsonc` for staging and production.
5. Deploy with `npm run deploy:staging` or `npm run deploy:production`.

### Database configuration

The deployed Worker connects through Cloudflare Hyperdrive and does not require a `DATABASE_URL` Worker secret. `DATABASE_URL` is only needed by the local/CI migration commands (`npm run db:migrate` and `npm run predeploy`) because those commands run outside the Worker and connect directly to PostgreSQL.

Provision a PostgreSQL database and create the `authenticated_user` role before running migrations. For local migrations, copy `.env.example` to `.env` and set `DATABASE_URL` to the database connection string. For local `npm run dev`, put the connection string in `.dev.vars` as `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_DATABASE_HYPERDRIVE` (the dev script loads it into the process environment; wrangler does not read it from `.dev.vars` directly). Local development should use an explicit environment, such as `npm run dev -- --env staging`, so the corresponding KV bindings are loaded.

## Contributing

I welcome contributions of all kinds! Whether you're fixing bugs, adding new
features, improving documentation, or suggesting enhancements, your efforts are
appreciated.

Play, Create & Share
