# Game server

A secure game server built for multiplayer games.

[![Deploy on Deno](https://deno.com/button)](https://console.deno.com/new?clone=https://github.com/MiguelRipoll23/gameserver&predeploy=deno%20task%20migrate)

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

## Configuration

Follow the steps below after using the `Deploy` button above this section:

1. On the Deno Deploy project page, go to Settings → Environment Variables.
2. Copy `.env.example` to `.env` (Deno Deploy requires the `.env` extension when
   importing).
3. Drag and drop the `.env` file onto the Environment Variables panel, or click
   Import and select the file.

### Database configuration

Provision a database and create the `authenticated_user` role in your production
branch of your database so the migrations can be automatically applied when
being deployed.

## Contributing

I welcome contributions of all kinds! Whether you're fixing bugs, adding new
features, improving documentation, or suggesting enhancements, your efforts are
appreciated.

Play, Create & Share
