import { createMiddleware } from "hono/factory";
import { verifySignature } from "discordeno";
import { injectable } from "@needle-di/core";
import { ServerError } from "../versions/v1/models/server-error.ts";
import {
  ENV_DISCORD_BOT_TOKEN,
  ENV_DISCORD_PUBLIC_KEY,
} from "../versions/v1/constants/environment-constants.ts";
import type { DiscordInteractionPayload } from "../versions/v1/types/discord-interaction-payload-type.ts";

const TIMESTAMP_FRESHNESS_MS = 300_000;

@injectable()
export class DiscordSignatureVerificationMiddleware {
  public create() {
    return createMiddleware(async (context, next) => {
      const publicKey = Deno.env.get(ENV_DISCORD_PUBLIC_KEY);
      const botToken = Deno.env.get(ENV_DISCORD_BOT_TOKEN);
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

      const parsedTimestamp = Date.parse(timestamp);
      if (
        Number.isNaN(parsedTimestamp) ||
        Math.abs(Date.now() - parsedTimestamp) > TIMESTAMP_FRESHNESS_MS
      ) {
        throw new ServerError(
          "DISCORD_SIGNATURE_STALE",
          "Stale Discord interaction timestamp",
          401,
        );
      }

      const body = await context.req.text();
      const { isValid } = verifySignature({
        publicKey,
        signature,
        timestamp,
        body,
      });
      if (!isValid) {
        throw new ServerError(
          "DISCORD_SIGNATURE_INVALID",
          "Invalid Discord signature",
          401,
        );
      }

      let payload: DiscordInteractionPayload;
      try {
        const parsed = JSON.parse(body) as DiscordInteractionPayload & {
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
