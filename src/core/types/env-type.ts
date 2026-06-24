export interface Env {
  DATABASE_URL: string;
  DATABASE_URL_UNPOOLED?: string;
  JWT_SECRET: string;
  RP_NAME?: string;
  RP_ALLOWED_ORIGINS: string;
  GAME_URL?: string;
  CLOUDFLARE_CALLS_URL?: string;
  CLOUDFLARE_CALLS_TOKEN?: string;
  GAME_SERVER_DO: DurableObjectNamespace;
  HYPERDRIVE: { connectionString: string };
}
