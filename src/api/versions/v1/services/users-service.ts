import { inject, injectable } from "@needle-di/core";
import { Logger } from "../../../../core/utils/logger.ts";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { ServerError } from "../models/server-error.ts";
import {
  rolesTable,
  userRolesTable,
  usersTable,
} from "../../../../db/schema.ts";
import { and, desc, eq, lt, ne } from "drizzle-orm";
import type { StringPaginationParams } from "../schemas/pagination-schemas.ts";
import type { GetUsersResponse, UserResponse } from "../schemas/users-schemas.ts";
import type { UserEntity } from "../../../../db/tables/users-table.ts";

@injectable()
export class UsersService {
  constructor(private databaseService = inject(DatabaseService)) {}

  public async list(
    params: StringPaginationParams,
  ): Promise<GetUsersResponse> {
    const { cursor, limit = 20 } = params;
    const db = this.databaseService.get();

    try {
      const conditions = cursor
        ? [lt(usersTable.id, cursor)]
        : undefined;

      const query = db
        .select()
        .from(usersTable)
        .where(conditions ? conditions[0] : undefined)
        .orderBy(desc(usersTable.id))
        .limit(limit + 1);

      const users = await query;

      const hasNextPage = users.length > limit;
      const results = users.slice(0, limit).map((user) => ({
        id: user.id,
        displayName: user.displayName,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt?.toISOString() || null,
      })) as UserResponse[];

      return {
        results,
        nextCursor: hasNextPage && results.length > 0
          ? results[results.length - 1].id
          : undefined,
        hasMore: hasNextPage,
      };
    } catch (error) {
      Logger.error("Failed to query users:", error);
      throw new ServerError("DATABASE_ERROR", "Failed to retrieve users", 500);
    }
  }

  public async updateUser(
    userId: string,
    displayName: string,
  ): Promise<void> {
    const db = this.databaseService.get();

    try {
      await db.transaction(async (tx) => {
        // Check if user exists and lock the row to prevent race conditions
        const users = await tx
          .select()
          .from(usersTable)
          .where(eq(usersTable.id, userId))
          .for("update")
          .limit(1);

        if (users.length === 0) {
          throw new ServerError("USER_NOT_FOUND", "User not found", 404);
        }

        // Check for display name conflict with other users
        const conflicting = await tx
          .select({ id: usersTable.id })
          .from(usersTable)
          .where(
            and(
              eq(usersTable.displayName, displayName),
              ne(usersTable.id, userId),
            ),
          )
          .limit(1);

        if (conflicting.length > 0) {
          throw new ServerError(
            "DISPLAY_NAME_TAKEN",
            "Display name is already in use by another user",
            409,
          );
        }

        // Update the user display name and refresh the updated timestamp
        await tx
          .update(usersTable)
          .set({ displayName, updatedAt: new Date() })
          .where(eq(usersTable.id, userId));
      });
    } catch (error) {
      if (error instanceof ServerError) throw error;
      Logger.error("Failed to update user:", error);
      throw new ServerError("DATABASE_ERROR", "Failed to update user", 500);
    }
  }

  public async getByIdOrThrow(userId: string): Promise<UserEntity> {
    try {
      const users = await this.databaseService.executeWithUserContext(
        userId,
        (tx) => {
          return tx
            .select()
            .from(usersTable)
            .where(eq(usersTable.id, userId))
            .limit(1);
        },
      );

      if (users.length === 0) {
        throw new ServerError("USER_NOT_FOUND", "User not found", 400);
      }

      return users[0];
    } catch (error) {
      if (error instanceof ServerError) throw error;
      Logger.error("Failed to query user:", error);
      throw new ServerError("DATABASE_ERROR", "Failed to retrieve user", 500);
    }
  }

  public async getRoles(userId: string): Promise<string[]> {
    try {
      const userRoleResults = await this.databaseService.executeWithUserContext(
        userId,
        (tx) => {
          return tx
            .select({ name: rolesTable.name })
            .from(userRolesTable)
            .innerJoin(rolesTable, eq(userRolesTable.roleId, rolesTable.id))
            .where(eq(userRolesTable.userId, userId));
        },
      );

      return userRoleResults.map((role: { name: string }) => role.name);
    } catch (error) {
      Logger.error("Failed to query user roles:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to retrieve user roles",
        500,
      );
    }
  }
}
