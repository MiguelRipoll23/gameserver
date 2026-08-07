import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { inject, injectable } from "@needle-di/core";
import { DiscordCommandService } from "../../services/discord-command-service.ts";
import { DiscordSignatureVerificationMiddleware } from "../../../../middlewares/discord-signature-verification-middleware.ts";
import { DiscordInteractionResponseType } from "../../enums/discord-interaction-response-enum.ts";
import { DiscordInteractionType } from "../../enums/discord-interaction-enum.ts";
import { ServerError } from "../../models/server-error.ts";
import { ServerResponse } from "../../models/server-response.ts";
import {
  DiscordInteractionPayloadSchema,
  DiscordInteractionResponseSchema,
} from "../../schemas/discord-interaction-schemas.ts";
import type { DiscordInteractionPayload } from "../../types/discord-interaction-payload-type.ts";
import type { DiscordInteractionResponse } from "../../types/discord-interaction-response-type.ts";

@injectable()
export class PublicDiscordInteractionsRouter {
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
    this.registerInteractionsRoute();
  }

  private registerInteractionsRoute(): void {
    this.app.openapi(
      createRoute({
        method: "post",
        path: "/interactions",
        summary: "Handle Discord interaction",
        description:
          "Verifies and processes an incoming Discord HTTP interaction",
        tags: ["Discord"],
        request: {
          body: {
            content: {
              "application/json": {
                schema: DiscordInteractionPayloadSchema,
              },
            },
          },
        },
        responses: {
          200: {
            description: "Responds to the interaction",
            content: {
              "application/json": {
                schema: DiscordInteractionResponseSchema,
              },
            },
          },
          ...ServerResponse.BadRequest,
          ...ServerResponse.Unauthorized,
          ...ServerResponse.Forbidden,
        },
      }),
      async (c) => {
        const payload = c.get(
          "discordInteraction",
        ) as DiscordInteractionPayload;
        const commandName = payload.data?.name ?? "unknown";

        console.info(
          "Discord interaction received:",
          JSON.stringify({
            interactionId: payload.id,
            type: payload.type,
            command: commandName,
            guildId: payload.guildId ?? null,
          }),
        );

        if (payload.type === DiscordInteractionType.Ping) {
          console.info(
            "Discord interaction completed:",
            JSON.stringify({
              interactionId: payload.id,
              command: "ping",
              outcome: "pong",
            }),
          );
          return c.json(
            {
              type: DiscordInteractionResponseType.Pong,
            } satisfies DiscordInteractionResponse,
            200,
          );
        }

        if (payload.type !== DiscordInteractionType.ApplicationCommand) {
          throw new ServerError(
            "DISCORD_UNSUPPORTED_INTERACTION",
            "Unsupported interaction type",
            400,
          );
        }

        const response = await this.commandService.handle(payload);
        console.info(
          "Discord interaction completed:",
          JSON.stringify({
            interactionId: payload.id,
            command: commandName,
            outcome: "response",
          }),
        );
        return c.json(response, 200);
      },
    );
  }
}
