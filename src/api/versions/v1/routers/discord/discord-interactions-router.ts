import { OpenAPIHono } from "@hono/zod-openapi";
import { inject, injectable } from "@needle-di/core";
import { DiscordCommandService } from "../../services/discord-command-service.ts";
import { DiscordSignatureVerificationMiddleware } from "../../../../middlewares/discord-signature-verification-middleware.ts";
import { DiscordInteractionResponseType } from "../../enums/discord-interaction-response-enum.ts";
import { DiscordInteractionType } from "../../enums/discord-interaction-enum.ts";
import type { DiscordInteractionPayload } from "../../types/discord-interaction-payload-type.ts";

@injectable()
export class DiscordInteractionsRouter {
  private app: OpenAPIHono<{
    Variables: { discordInteraction: DiscordInteractionPayload };
  }>;

  constructor(
    private signatureMiddleware = inject(
      DiscordSignatureVerificationMiddleware,
    ),
    private commandService = inject(DiscordCommandService),
  ) {
    this.app = new OpenAPIHono();
    this.setMiddlewares();
    this.setRoutes();
  }

  public getRouter(): OpenAPIHono<{
    Variables: { discordInteraction: DiscordInteractionPayload };
  }> {
    return this.app;
  }

  private setMiddlewares(): void {
    this.app.use(
      "/interactions",
      this.signatureMiddleware.create(),
    );
  }

  private setRoutes(): void {
    this.app.post("/interactions", async (c) => {
      const payload = c.get("discordInteraction") as DiscordInteractionPayload;

      if (payload.type === DiscordInteractionType.Ping) {
        return c.json({ type: DiscordInteractionResponseType.Pong });
      }

      if (payload.type !== DiscordInteractionType.ApplicationCommand) {
        return c.text("Bad request", 400);
      }

      const response = await this.commandService.handle(payload);
      return c.json(response);
    });
  }
}
