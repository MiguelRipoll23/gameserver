import { inject, injectable } from "@needle-di/core";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { BotManagementService } from "../../services/bot-management-service.ts";
import { HonoVariables } from "../../../../../core/types/hono-variables-type.ts";
import {
  AddBotRoleRequestSchema,
  CreateBotRequestSchema,
  CreateBotResponseSchema,
  GetBotRolesResponseSchema,
  GetBotsQuerySchema,
  GetBotsResponseSchema,
  GetBotTokenRequestSchema,
  GetBotTokenResponseSchema,
  RemoveBotRoleRequestSchema,
  UpdateBotRequestSchema,
  UpdateBotResponseSchema,
} from "../../schemas/management-bot-schemas.ts";
import { ServerResponse } from "../../models/server-response.ts";

@injectable()
export class ManagementBotRouter {
  private app: OpenAPIHono<{ Variables: HonoVariables }>;

  constructor(private botManagementService = inject(BotManagementService)) {
    this.app = new OpenAPIHono();
    this.setRoutes();
  }

  public getRouter(): OpenAPIHono<{ Variables: HonoVariables }> {
    return this.app;
  }

  private setRoutes(): void {
    this.registerGetBotsRoute();
    this.registerCreateBotRoute();
    this.registerUpdateBotRoute();
    this.registerDeleteBotRoute();
    this.registerGetBotTokenRoute();
    this.registerGetBotRolesRoute();
    this.registerAddBotRoleRoute();
    this.registerRemoveBotRoleRoute();
  }

  private registerCreateBotRoute(): void {
    this.app.openapi(
      createRoute({
        method: "post",
        path: "/",
        summary: "Create bot",
        description: "Creates a new bot account",
        tags: ["Bots"],
        request: {
          body: {
            content: {
              "application/json": {
                schema: CreateBotRequestSchema,
              },
            },
          },
        },
        responses: {
          200: {
            description: "Responds with the created bot",
            content: {
              "application/json": {
                schema: CreateBotResponseSchema,
              },
            },
          },
          ...ServerResponse.BadRequest,
          ...ServerResponse.Unauthorized,
          ...ServerResponse.Forbidden,
          ...ServerResponse.Conflict,
        },
      }),
      async (c) => {
        const body = c.req.valid("json");
        const creatorUserId = c.get("userId") as string;

        const response = await this.botManagementService.createBot(
          body,
          creatorUserId,
        );

        return c.json(response, 200);
      },
    );
  }

  private registerGetBotsRoute(): void {
    this.app.openapi(
      createRoute({
        method: "get",
        path: "/",
        summary: "Get bots",
        description: "Lists the bots created by the requesting manager",
        tags: ["Bots"],
        request: {
          query: GetBotsQuerySchema,
        },
        responses: {
          200: {
            description: "Responds with the bots created by the user",
            content: {
              "application/json": {
                schema: GetBotsResponseSchema,
              },
            },
          },
          ...ServerResponse.BadRequest,
          ...ServerResponse.Unauthorized,
          ...ServerResponse.Forbidden,
        },
      }),
      async (c) => {
        const creatorUserId = c.get("userId") as string;
        const query = c.req.valid("query");

        const response = await this.botManagementService.getBots(
          creatorUserId,
          query,
        );

        return c.json(response, 200);
      },
    );
  }

  private registerUpdateBotRoute(): void {
    this.app.openapi(
      createRoute({
        method: "patch",
        path: "/:botId",
        summary: "Update bot",
        description: "Updates a bot's name and/or description",
        tags: ["Bots"],
        request: {
          params: z.object({
            botId: z.string().uuid().describe("The bot ID to update"),
          }),
          body: {
            content: {
              "application/json": {
                schema: UpdateBotRequestSchema,
              },
            },
          },
        },
        responses: {
          200: {
            description: "Responds with the updated bot",
            content: {
              "application/json": {
                schema: UpdateBotResponseSchema,
              },
            },
          },
          ...ServerResponse.BadRequest,
          ...ServerResponse.Unauthorized,
          ...ServerResponse.Forbidden,
          ...ServerResponse.NotFound,
          ...ServerResponse.Conflict,
        },
      }),
      async (c) => {
        const botId = c.req.param("botId");
        const body = c.req.valid("json");
        const requesterUserId = c.get("userId") as string;

        const response = await this.botManagementService.updateBot(
          botId,
          body,
          requesterUserId,
        );

        return c.json(response, 200);
      },
    );
  }

  private registerDeleteBotRoute(): void {
    this.app.openapi(
      createRoute({
        method: "delete",
        path: "/:botId",
        summary: "Delete bot",
        description: "Deletes a bot and all of its associated data",
        tags: ["Bots"],
        request: {
          params: z.object({
            botId: z.string().uuid().describe("The bot ID to delete"),
          }),
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
        const botId = c.req.param("botId");
        const requesterUserId = c.get("userId") as string;

        await this.botManagementService.deleteBot(botId, requesterUserId);

        return c.body(null, 204);
      },
    );
  }

  private registerGetBotTokenRoute(): void {
    this.app.openapi(
      createRoute({
method: "post",
        path: "/token",
        summary: "Get bot token",
        description:
          "Mints a long-lived JWT for the bot reflecting its current roles",
        tags: ["Bots"],
        request: {
          body: {
            content: {
              "application/json": {
                schema: GetBotTokenRequestSchema,
              },
            },
          },
        },
        responses: {
          200: {
            description: "Responds with the bot token",
            content: {
              "application/json": {
                schema: GetBotTokenResponseSchema,
              },
            },
          },
          ...ServerResponse.BadRequest,
          ...ServerResponse.Unauthorized,
          ...ServerResponse.Forbidden,
          ...ServerResponse.NotFound,
        },
      }),
      async (c) => {
        const { botId } = c.req.valid("json");
        const requesterUserId = c.get("userId") as string;

        const response = await this.botManagementService.getBotToken(
          botId,
          requesterUserId,
        );

        return c.json(response, 200);
      },
    );
  }

  private registerGetBotRolesRoute(): void {
    this.app.openapi(
      createRoute({
        method: "get",
        path: "/:botId/roles",
        summary: "Get bot roles",
        description: "Retrieves all roles assigned to a specific bot",
        tags: ["Bot roles"],
        request: {
          params: z.object({
            botId: z
              .string()
              .uuid()
              .describe("The bot ID to get roles for"),
          }),
        },
        responses: {
          200: {
            description: "Responds with the bot roles",
            content: {
              "application/json": {
                schema: GetBotRolesResponseSchema,
              },
            },
          },
          ...ServerResponse.BadRequest,
          ...ServerResponse.Unauthorized,
          ...ServerResponse.Forbidden,
          ...ServerResponse.NotFound,
        },
      }),
      async (c) => {
        const botId = c.req.param("botId");
        const requesterUserId = c.get("userId") as string;

        const response = await this.botManagementService.getBotRoles(
          botId,
          requesterUserId,
        );

        return c.json(response, 200);
      },
    );
  }

  private registerAddBotRoleRoute(): void {
    this.app.openapi(
      createRoute({
        method: "post",
        path: "/:botId/roles",
        summary: "Add bot role",
        description: "Assigns a role to a specific bot",
        tags: ["Bot roles"],
        request: {
          params: z.object({
            botId: z
              .string()
              .uuid()
              .describe("The bot ID to add a role to"),
          }),
          body: {
            content: {
              "application/json": {
                schema: AddBotRoleRequestSchema,
              },
            },
          },
        },
        responses: {
          204: {
            description: "Role successfully added to bot",
          },
          ...ServerResponse.BadRequest,
          ...ServerResponse.Unauthorized,
          ...ServerResponse.Forbidden,
          ...ServerResponse.NotFound,
          ...ServerResponse.Conflict,
        },
      }),
      async (c) => {
        const botId = c.req.param("botId");
        const body = c.req.valid("json");
        const requesterUserId = c.get("userId") as string;

        await this.botManagementService.addBotRole(
          botId,
          body,
          requesterUserId,
        );

        return c.body(null, 204);
      },
    );
  }

  private registerRemoveBotRoleRoute(): void {
    this.app.openapi(
      createRoute({
        method: "delete",
        path: "/:botId/roles",
        summary: "Remove bot role",
        description: "Removes a role from a specific bot",
        tags: ["Bot roles"],
        request: {
          params: z.object({
            botId: z
              .string()
              .uuid()
              .describe("The bot ID to remove a role from"),
          }),
          body: {
            content: {
              "application/json": {
                schema: RemoveBotRoleRequestSchema,
              },
            },
          },
        },
        responses: {
          204: {
            description: "Role successfully removed from bot",
          },
          ...ServerResponse.BadRequest,
          ...ServerResponse.Unauthorized,
          ...ServerResponse.Forbidden,
          ...ServerResponse.NotFound,
        },
      }),
      async (c) => {
        const botId = c.req.param("botId");
        const body = c.req.valid("json");
        const requesterUserId = c.get("userId") as string;

        await this.botManagementService.removeBotRole(
          botId,
          body,
          requesterUserId,
        );

        return c.body(null, 204);
      },
    );
  }
}
