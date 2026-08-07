import { createMiddleware } from "hono/factory";
import nacl from "tweetnacl";
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
 * Verifies a Discord interaction request signature (Ed25519) using tweetnacl.
 * Discord signs `timestamp + rawBody` with the application's Ed25519 key; both
 * the signature and the public key are hex-encoded in the interaction request.
 */
function isSignatureValid(
  publicKey: string,
  signature: string,
  timestamp: string,
  body: string,
): boolean {
  try {
    const message = new TextEncoder().encode(timestamp + body);
    const signatureBytes = hexToBytes(signature, 64);
    const publicKeyBytes = hexToBytes(publicKey, 32);
    return nacl.sign.detached.verify(message, signatureBytes, publicKeyBytes);
  } catch {
    return false;
  }
}

function hexToBytes(hex: string, expectedLength: number): Uint8Array {
  if (hex.length !== expectedLength * 2) {
    throw new Error("Invalid hex string length");
  }

  const bytes = new Uint8Array(expectedLength);
  for (let i = 0; i < expectedLength; i++) {
    const byte = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) {
      throw new Error("Invalid hex string");
    }
    bytes[i] = byte;
  }

  return bytes;
}

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
      const parsedTimestamp = Number.isFinite(timestampSeconds)
        ? timestampSeconds * 1000
        : Date.parse(timestamp);
      if (
        !Number.isFinite(parsedTimestamp) ||
        Math.abs(Date.now() - parsedTimestamp) > TIMESTAMP_FRESHNESS_MS
      ) {
        throw new ServerError(
          "DISCORD_SIGNATURE_STALE",
          "Stale Discord interaction timestamp",
          401,
        );
      }

      const body = await context.req.text();
      const isValid = isSignatureValid(publicKey, signature, timestamp, body);
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
