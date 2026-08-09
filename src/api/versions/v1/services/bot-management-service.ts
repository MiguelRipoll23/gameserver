import { inject, injectable } from "@needle-di/core";
import { Logger } from "../../../../core/utils/logger.ts";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { JWTService } from "../../../../core/services/jwt-service.ts";
import { ServerError } from "../models/server-error.ts";
import { botRolesTable, botsTable, rolesTable } from "../../../../db/schema.ts";
import { and, eq, gt } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { StringPaginationParams } from "../schemas/pagination-schemas.ts";
import {
  AddBotRoleRequest,
  CreateBotRequest,
  CreateBotResponse,
  GetBotRolesResponse,
  GetBotsResponse,
  GetBotTokenResponse,
  RemoveBotRoleRequest,
  UpdateBotRequest,
  UpdateBotResponse,
} from "../schemas/management-bot-schemas.ts";

@injectable()
export class BotManagementService {
  constructor(
    private databaseService = inject(DatabaseService),
    private jwtService = inject(JWTService),
  ) {}

  private isDuplicateNameError(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      (error as { code?: unknown }).code === "23505"
    );
  }

  private isForeignKeyViolationError(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      (error as { code?: unknown }).code === "23503"
    );
  }

  public async createBot(
    request: CreateBotRequest,
    creatorUserId: string,
  ): Promise<CreateBotResponse> {
    const name = request.name;
    const description = request.description ?? null;
    const botId = crypto.randomUUID();

    try {
      await this.databaseService.executeWithUserContext(
        creatorUserId,
        (tx) => {
          return tx.insert(botsTable).values({
            id: botId,
            name,
            ...(description !== null ? { description } : {}),
            createdBy: creatorUserId,
          });
        },
      );
    } catch (error) {
      if (error instanceof ServerError) throw error;
      if (this.isDuplicateNameError(error)) {
        throw new ServerError(
          "BOT_NAME_TAKEN",
          "A bot with this name already exists",
          409,
        );
      }
      if (this.isForeignKeyViolationError(error)) {
        throw new ServerError(
          "USER_NOT_FOUND",
          "Authenticated user does not exist",
          404,
        );
      }
      Logger.error("Failed to create bot:", error);
      throw new ServerError(
        "BOT_CREATION_FAILED",
        "Failed to create bot",
        500,
      );
    }

    return {
      id: botId,
      name,
      description,
    };
  }

  public async updateBot(
    botId: string,
    request: UpdateBotRequest,
    requesterUserId: string,
  ): Promise<UpdateBotResponse> {
    try {
      return await this.databaseService.executeWithUserContext(
        requesterUserId,
        async (tx) => {
          await this.getBotOrThrow(tx, botId);

          const updates: Record<string, string | null> = {};

          if (request.name !== undefined) {
            updates.name = request.name;
          }

          if (request.description !== undefined) {
            updates.description = request.description;
          }

          const rows = await tx
            .update(botsTable)
            .set(updates)
            .where(eq(botsTable.id, botId))
            .returning();

          const updatedBot = rows[0];

          return {
            id: updatedBot.id,
            name: updatedBot.name,
            description: updatedBot.description,
            createdBy: updatedBot.createdBy,
            createdAt: updatedBot.createdAt.toISOString(),
          };
        },
      );
    } catch (error) {
      if (error instanceof ServerError) throw error;
      Logger.error("Failed to update bot:", error);
      throw new ServerError(
        "BOT_UPDATE_FAILED",
        "Failed to update bot",
        500,
      );
    }
  }

  public async deleteBot(
    botId: string,
    requesterUserId: string,
  ): Promise<void> {
    try {
      await this.databaseService.executeWithUserContext(
        requesterUserId,
        async (tx) => {
          await this.getBotOrThrow(tx, botId);

          await tx.delete(botsTable).where(eq(botsTable.id, botId));
        },
      );
    } catch (error) {
      if (error instanceof ServerError) throw error;
      Logger.error("Failed to delete bot:", error);
      throw new ServerError(
        "BOT_DELETION_FAILED",
        "Failed to delete bot",
        500,
      );
    }
  }

  public async getBots(
    creatorUserId: string,
    params: Partial<StringPaginationParams> = {},
  ): Promise<GetBotsResponse> {
    const { cursor, limit = 20 } = params;

    try {
      const conditions: SQL[] = [];

      if (cursor !== undefined) {
        const botId = this.decodeCursor(cursor);
        conditions.push(gt(botsTable.id, botId));
      }

      const bots = await this.databaseService.executeWithUserContext(
        creatorUserId,
        (tx) => {
          return tx
            .select()
            .from(botsTable)
            .where(
              and(
                eq(botsTable.createdBy, creatorUserId),
                conditions.length > 0 ? conditions[0] : undefined,
              ),
            )
            .orderBy(botsTable.id)
            .limit(limit + 1);
        },
      );

      const hasNextPage = bots.length > limit;
      const results = bots.slice(0, limit);

      return {
        results: results.map((bot) => ({
          id: bot.id,
          name: bot.name,
          description: bot.description,
          createdBy: bot.createdBy,
          createdAt: bot.createdAt.toISOString(),
        })),
        nextCursor: hasNextPage && results.length > 0
          ? this.encodeCursor(results[results.length - 1].id)
          : undefined,
        hasMore: hasNextPage,
      };
    } catch (error) {
      if (error instanceof ServerError) throw error;
      Logger.error("Failed to fetch bots:", error);
      throw new ServerError("DATABASE_ERROR", "Failed to fetch bots", 500);
    }
  }

  public async getBotToken(
    botId: string,
    requesterUserId: string,
  ): Promise<GetBotTokenResponse> {
    try {
      const result = await this.databaseService.executeWithUserContext(
        requesterUserId,
        async (tx) => {
          const bot = await this.getBotOrThrow(tx, botId);

          const roleRows = await tx
            .select({ name: rolesTable.name })
            .from(botRolesTable)
            .innerJoin(rolesTable, eq(botRolesTable.roleId, rolesTable.id))
            .where(eq(botRolesTable.botId, botId));

          return {
            botName: bot.name,
            roles: roleRows.map((role: { name: string }) => role.name),
          };
        },
      );

      const token = await this.jwtService.sign(
        {
          sub: botId,
          name: result.botName,
          roles: result.roles,
          tokenType: "bot",
        },
        null,
      );

      return { token };
    } catch (error) {
      if (error instanceof ServerError) throw error;
      Logger.error("Failed to mint bot token:", error);
      throw new ServerError(
        "BOT_TOKEN_CREATION_FAILED",
        "Failed to create bot token",
        500,
      );
    }
  }

  public async getBotRoles(
    botId: string,
    requesterUserId: string,
  ): Promise<GetBotRolesResponse> {
    try {
      return await this.databaseService.executeWithUserContext(
        requesterUserId,
        async (tx) => {
          await this.getBotOrThrow(tx, botId);

          const roleRows = await tx
            .select({
              botId: botRolesTable.botId,
              roleName: rolesTable.name,
              createdAt: botRolesTable.createdAt,
            })
            .from(botRolesTable)
            .innerJoin(rolesTable, eq(botRolesTable.roleId, rolesTable.id))
            .where(eq(botRolesTable.botId, botId));

          return roleRows.map((role) => ({
            botId: role.botId,
            roleName: role.roleName,
            createdAt: role.createdAt.toISOString(),
          }));
        },
      );
    } catch (error) {
      if (error instanceof ServerError) throw error;
      Logger.error("Failed to fetch bot roles:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to fetch bot roles",
        500,
      );
    }
  }

  public async addBotRole(
    botId: string,
    request: AddBotRoleRequest,
    requesterUserId: string,
  ): Promise<void> {
    const { roleName } = request;

    try {
      await this.databaseService.executeWithUserContext(
        requesterUserId,
        async (tx) => {
          await this.getBotOrThrow(tx, botId);

          const roleId = await this.getOrCreateRoleByName(tx, roleName);

          const result = await tx
            .insert(botRolesTable)
            .values({ botId, roleId })
            .onConflictDoNothing({
              target: [botRolesTable.botId, botRolesTable.roleId],
            })
            .returning({ id: botRolesTable.id });

          if (result.length === 0) {
            throw new ServerError(
              "ROLE_ALREADY_EXISTS",
              "Bot already has this role",
              409,
            );
          }
        },
      );
    } catch (error) {
      if (error instanceof ServerError) throw error;
      Logger.error("Error adding bot role:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to add bot role",
        500,
      );
    }
  }

  public async removeBotRole(
    botId: string,
    request: RemoveBotRoleRequest,
    requesterUserId: string,
  ): Promise<void> {
    const { roleName } = request;

    try {
      await this.databaseService.executeWithUserContext(
        requesterUserId,
        async (tx) => {
          await this.getBotOrThrow(tx, botId);

          const roleId = await this.getRoleIdByName(tx, roleName);

          const result = await tx
            .delete(botRolesTable)
            .where(
              and(
                eq(botRolesTable.botId, botId),
                eq(botRolesTable.roleId, roleId),
              ),
            )
            .returning({ id: botRolesTable.id });

          if (result.length === 0) {
            throw new ServerError(
              "ROLE_NOT_FOUND",
              "Bot does not have this role",
              404,
            );
          }
        },
      );
    } catch (error) {
      if (error instanceof ServerError) throw error;
      Logger.error("Error removing bot role:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to remove bot role",
        500,
      );
    }
  }

  private async getBotOrThrow(
    tx: NodePgDatabase,
    botId: string,
  ): Promise<{ id: string; name: string }> {
    const bots = await tx
      .select()
      .from(botsTable)
      .where(eq(botsTable.id, botId))
      .limit(1);

    if (bots.length === 0) {
      throw new ServerError("BOT_NOT_FOUND", "Bot not found", 404);
    }

    return { id: bots[0].id, name: bots[0].name };
  }

  private async getRoleIdByName(
    tx: NodePgDatabase,
    roleName: string,
  ): Promise<number> {
    const roles = await tx
      .select({ id: rolesTable.id })
      .from(rolesTable)
      .where(eq(rolesTable.name, roleName))
      .limit(1);

    if (roles.length === 0) {
      throw new ServerError("ROLE_NOT_FOUND", "Role not found", 404);
    }

    return roles[0].id;
  }

  private async getOrCreateRoleByName(
    tx: NodePgDatabase,
    roleName: string,
  ): Promise<number> {
    const existingRoles = await tx
      .select({ id: rolesTable.id })
      .from(rolesTable)
      .where(eq(rolesTable.name, roleName))
      .limit(1);

    if (existingRoles.length > 0) {
      return existingRoles[0].id;
    }

    const newRoles = await tx
      .insert(rolesTable)
      .values({ name: roleName })
      .returning({ id: rolesTable.id });

    return newRoles[0].id;
  }

  private encodeCursor(id: string): string {
    return btoa(id);
  }

  private decodeCursor(cursor: string): string {
    try {
      return atob(cursor);
    } catch (_error) {
      throw new ServerError(
        "INVALID_CURSOR",
        "Invalid pagination cursor format",
        400,
      );
    }
  }
}
