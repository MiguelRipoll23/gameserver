import { inject, injectable } from "@needle-di/core";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { TextModerationService } from "../../services/text-moderation-service.ts";
import { ChatService } from "../../services/chat-service.ts";
import {
  BlockWordRequestSchema,
  CheckWordRequestSchema,
  UnblockWordRequestSchema,
  WordBlockedResponseSchema,
} from "../../schemas/text-moderation-schemas.ts";
import { ServerResponse } from "../../models/server-response.ts";

@injectable()
export class ManagementTextModerationRouter {
  private app: OpenAPIHono;

  constructor(
    private textModerationService = inject(TextModerationService),
    private chatService = inject(ChatService)
  ) {
    this.app = new OpenAPIHono();
    this.setRoutes();
  }

  public getRouter(): OpenAPIHono {
    return this.app;
  }

  private setRoutes(): void {
    this.registerCheckWordRoute();
    this.registerBlockWordRoute();
    this.registerUnblockWordRoute();
    this.registerRefreshCacheRoute();
  }

  private registerCheckWordRoute(): void {
    this.app.openapi(
      createRoute({
        method: "post",
        path: "/check-word",
        summary: "Check word",
        description: "Checks if a specific word is in the blocked words list",
        tags: ["Text moderation"],
        request: {
          body: {
            content: {
              "application/json": {
                schema: CheckWordRequestSchema,
              },
            },
          },
        },
        responses: {
          200: {
            description: "Word check result",
            content: {
              "application/json": {
                schema: WordBlockedResponseSchema,
              },
            },
          },
          ...ServerResponse.BadRequest,
          ...ServerResponse.Unauthorized,
          ...ServerResponse.Forbidden,
        },
      }),
      async (c) => {
        const validated = c.req.valid("json");
        const result = await this.textModerationService.isWordBlocked(
          validated
        );
        return c.json(result, 200);
      }
    );
  }

  private registerBlockWordRoute(): void {
    this.app.openapi(
      createRoute({
        method: "post",
        path: "/block-word",
        summary: "Block word",
        description: "Adds a word to the blocked words list",
        tags: ["Text moderation"],
        request: {
          body: {
            content: {
              "application/json": {
                schema: BlockWordRequestSchema,
              },
            },
          },
        },
        responses: {
          ...ServerResponse.NoContent,
          ...ServerResponse.BadRequest,
          ...ServerResponse.Unauthorized,
          ...ServerResponse.Forbidden,
          ...ServerResponse.Conflict,
        },
      }),
      async (c) => {
        const validated = c.req.valid("json");
        await this.textModerationService.blockWord(validated);
        return c.body(null, 204);
      }
    );
  }

  private registerUnblockWordRoute(): void {
    this.app.openapi(
      createRoute({
        method: "post",
        path: "/unblock-word",
        summary: "Unblock word",
        description: "Removes a word from the blocked words list",
        tags: ["Text moderation"],
        request: {
          body: {
            content: {
              "application/json": {
                schema: UnblockWordRequestSchema,
              },
            },
          },
        },
        responses: {
          ...ServerResponse.NoContent,
          ...ServerResponse.BadRequest,
          ...ServerResponse.Unauthorized,
          ...ServerResponse.Forbidden,
          ...ServerResponse.NotFound,
        },
      }),
      async (c) => {
        const validated = c.req.valid("json");
        await this.textModerationService.unblockWord(validated);
        return c.body(null, 204);
      }
    );
  }

  private registerRefreshCacheRoute(): void {
    this.app.openapi(
      createRoute({
        method: "post",
        path: "/refresh-cache",
        summary: "Refresh cache",
        description: "Refreshes the cached blocked words list for moderation",
        tags: ["Text moderation"],
        responses: {
          ...ServerResponse.NoContent,
          ...ServerResponse.Unauthorized,
          ...ServerResponse.Forbidden,
        },
      }),
      async (c) => {
        // Refresh the cache on this server (which will also broadcast to other servers)
        await this.chatService.refreshBlockedWordsCache();

        return c.body(null, 204);
      }
    );
  }
}
