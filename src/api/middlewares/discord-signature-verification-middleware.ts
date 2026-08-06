import { createMiddleware } from "hono/factory";
import { verifySignature } from "discordeno";
import { injectable } from "@needle-di/core";
import { ENV_DISCORD_PUBLIC_KEY } from "../versions/v1/constants/environment-constants.ts";
import type { DiscordInteractionPayload } from "../versions/v1/types/discord-interaction-payload-type.ts";

@injectable()
export class DiscordSignatureVerificationMiddleware {
  public create() {
    return createMiddleware(async (context, next) => {
      const publicKey = Deno.env.get(ENV_DISCORD_PUBLIC_KEY);
      if (!publicKey) {
        return context.body(null, 403);
      }

      const signature = context.req.header("X-Signature-Ed25519");
      const timestamp = context.req.header("X-Signature-Timestamp");
      if (!signature || !timestamp) {
        return context.body(null, 401);
      }

      const body = await context.req.text();
      const { isValid } = verifySignature({
        publicKey,
        signature,
        timestamp,
        body,
      });
      if (!isValid) {
        return context.body(null, 401);
      }

      try {
        const payload = JSON.parse(body) as DiscordInteractionPayload;
        if (typeof payload !== "object" || payload === null) {
          return context.body(null, 400);
        }
        context.set("discordInteraction", payload);
      } catch {
        return context.body(null, 400);
      }

      await next();
    });
  }
}
