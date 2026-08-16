import { createMiddleware } from "hono/factory";
import { verifyKey } from "discord-interactions";
import { injectable } from "@needle-di/core";
import { ServerError } from "../versions/v1/models/server-error.ts";
import {
  ENV_DISCORD_BOT_TOKEN,
  ENV_DISCORD_PUBLIC_KEY,
} from "../versions/v1/constants/environment-constants.ts";
import { env } from "cloudflare:workers";
import type { DiscordInteractionPayload } from "../versions/v1/types/discord-interaction-payload-type.ts";

const TIMESTAMP_FRESHNESS_MS = 300_000;

/**
 * Discord signs `timestamp + rawBody` with the application's Ed25519 key.
 * `verifyKey` keeps the raw body bytes intact while validating that signature.
 */
@injectable()
export class DiscordSignatureVerificationMiddleware {
  public create() {
    return createMiddleware(async (context, next) => {
      const publicKey = env[ENV_DISCORD_PUBLIC_KEY];
      const botToken = env[ENV_DISCORD_BOT_TOKEN];
      if (!publicKey || !botToken) {
        throw new ServerError(
          "DISCORD_NOT_CONFIGURED",
          "Discord bot is not configured",
          403,
        );
      }

      const signature = context.req.header("X-Signature-Ed25519");
      const timestamp = context.req.header("X-Signature-Timestamp");
      if (!signature || !timestamp) {
        throw new ServerError(
          "DISCORD_SIGNATURE_MISSING",
          "Missing Discord signature headers",
          401,
        );
      }

      const timestampSeconds = Number(timestamp);
      if (
        !/^\d+$/.test(timestamp) ||
        !Number.isSafeInteger(timestampSeconds) ||
        Math.abs(Date.now() - timestampSeconds * 1000) >
          TIMESTAMP_FRESHNESS_MS
      ) {
        throw new ServerError(
          "DISCORD_SIGNATURE_STALE",
          "Stale Discord interaction timestamp",
          401,
        );
      }

      const body = await context.req.arrayBuffer();
      const isValid = await verifyKey(
        body,
        signature,
        timestamp,
        publicKey,
      );
      if (!isValid) {
        throw new ServerError(
          "DISCORD_SIGNATURE_INVALID",
          "Invalid Discord signature",
          401,
        );
      }

      let payload: DiscordInteractionPayload;
      try {
        const bodyText = new TextDecoder().decode(body);
        const parsed = JSON.parse(bodyText) as DiscordInteractionPayload & {
          guild_id?: string;
        };
        if (typeof parsed !== "object" || parsed === null) {
          throw new ServerError(
            "DISCORD_PAYLOAD_INVALID",
            "Invalid Discord interaction payload",
            400,
          );
        }
        if (parsed.guildId === undefined && parsed.guild_id !== undefined) {
          parsed.guildId = parsed.guild_id;
        }
        payload = parsed;
      } catch (error) {
        if (error instanceof ServerError) throw error;
        throw new ServerError(
          "DISCORD_PAYLOAD_INVALID",
          "Invalid Discord interaction payload",
          400,
        );
      }

      context.set("discordInteraction", payload);
      await next();
    });
  }
}
