import { inject, injectable } from "@needle-di/core";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { TextModerationService } from "../../services/text-moderation-service.ts";
import {
  BlockWordRequestSchema,
  GetBlockedWordsRequestSchema,
  UnblockWordParamSchema,
  UpdateWordRequestSchema,
  GetBlockedWordsResponseSchema,
} from "../../schemas/text-moderation-schemas.ts";
import { ServerResponse } from "../../models/server-response.ts";

@injectable()
export class ManagementTextModerationRouter {
  private app: OpenAPIHono;

  constructor(private textModerationService = inject(TextModerationService)) {
    this.app = new OpenAPIHono();
    this.setRoutes();
  }

  public getRouter(): OpenAPIHono {
    return this.app;
  }

  private setRoutes(): void {
    this.registerGetBlockedWordsRoute();
    this.registerBlockWordRoute();
    this.registerUpdateWordRoute();
    this.registerUnblockWordRoute();
  }

  private registerGetBlockedWordsRoute(): void {
    this.app.openapi(
      createRoute({
        method: "get",
        path: "/blocked-words",
        summary: "Get blocked words",
        description:
          "Gets a paginated list of blocked words with optional filtering",
        tags: ["Blocked words"],
        request: {
          query: GetBlockedWordsRequestSchema,
        },
        responses: {
          200: {
            description: "Paginated list of blocked words",
            content: {
              "application/json": {
                schema: GetBlockedWordsResponseSchema,
              },
            },
          },
          ...ServerResponse.BadRequest,
          ...ServerResponse.Unauthorized,
          ...ServerResponse.Forbidden,
        },
      }),
      async (c) => {
        const validated = c.req.valid("query");
        const result = await this.textModerationService.getBlockedWords(
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
        tags: ["Blocked words"],
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

  private registerUpdateWordRoute(): void {
    this.app.openapi(
      createRoute({
        method: "put",
        path: "/update-word",
        summary: "Update word",
        description: "Updates an existing word in the blocked words list",
        tags: ["Blocked words"],
        request: {
          body: {
            content: {
              "application/json": {
                schema: UpdateWordRequestSchema,
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
          ...ServerResponse.Conflict,
        },
      }),
      async (c) => {
        const validated = c.req.valid("json");
        await this.textModerationService.updateWord(validated);
        return c.body(null, 204);
      }
    );
  }

  private registerUnblockWordRoute(): void {
    this.app.openapi(
      createRoute({
        method: "delete",
        path: "/blocked-words/{word}",
        summary: "Unblock word",
        description: "Removes a word from the blocked words list",
        tags: ["Blocked words"],
        request: {
          params: UnblockWordParamSchema,
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
        const word = c.req.param("word");
        await this.textModerationService.unblockWord({ word });
        return c.body(null, 204);
      }
    );
  }
}
