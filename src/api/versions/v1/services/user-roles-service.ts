import { inject, injectable } from "@needle-di/core";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { ServerError } from "../models/server-error.ts";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  AddUserRoleRequest,
  RemoveUserRoleRequest,
  GetUserRolesRequest,
  GetUserRolesResponse,
} from "../schemas/user-roles-schemas.ts";
import {
  usersTable,
  userRolesTable,
  rolesTable,
} from "../../../../db/schema.ts";
import { eq, and, gt } from "drizzle-orm";

@injectable()
export class UserRolesService {
  constructor(private databaseService = inject(DatabaseService)) {}

  public async getUserRoles(
    request: GetUserRolesRequest
  ): Promise<GetUserRolesResponse> {
    const { userId, cursor, limit = 20 } = request;
    const db = this.databaseService.get();

    try {
      return await db.transaction(async (tx) => {
        // Check if user exists
        await this.checkUserExists(tx, userId);

        // Build query conditions
        const conditions = [eq(userRolesTable.userId, userId)];

        if (cursor) {
          conditions.push(gt(userRolesTable.id, cursor));
        }

        // Fetch one extra item to determine if there are more results
        const userRoles = await tx
          .select({
            id: userRolesTable.id,
            userId: userRolesTable.userId,
            roleName: rolesTable.name,
            createdAt: userRolesTable.createdAt,
          })
          .from(userRolesTable)
          .innerJoin(rolesTable, eq(userRolesTable.roleId, rolesTable.id))
          .where(conditions.length > 1 ? and(...conditions) : conditions[0])
          .orderBy(userRolesTable.id)
          .limit(limit + 1);

        // Remove the extra item and use it to determine if there are more results
        const hasNextPage = userRoles.length > limit;
        const results = userRoles.slice(0, limit);

        return {
          results: results.map((userRole) => ({
            userId: userRole.userId,
            roleName: userRole.roleName,
            createdAt: userRole.createdAt.toISOString(),
          })),
          nextCursor:
            hasNextPage && results.length > 0
              ? results[results.length - 1].id
              : undefined,
          hasMore: hasNextPage,
        };
      });
    } catch (error) {
      if (error instanceof ServerError) {
        throw error;
      }
      console.error("Database error while fetching user roles:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to fetch user roles",
        500
      );
    }
  }

  public async addUserRole(body: AddUserRoleRequest): Promise<void> {
    const { userId, roleName } = body;
    const db = this.databaseService.get();

    try {
      await db.transaction(async (tx) => {
        // Check if user exists
        await this.checkUserExists(tx, userId);

        // Get or create role ID by name
        const roleId = await this.getOrCreateRoleByName(tx, roleName);

        // Add the role to the user
        const result = await tx
          .insert(userRolesTable)
          .values({
            userId,
            roleId,
          })
          .onConflictDoNothing({
            target: [userRolesTable.userId, userRolesTable.roleId],
          })
          .returning({ userId: userRolesTable.userId });

        if (result.length === 0) {
          throw new ServerError(
            "ROLE_ALREADY_EXISTS",
            "User already has this role",
            409
          );
        }
      });
    } catch (error) {
      if (error instanceof ServerError) {
        throw error;
      }
      console.error("Error adding user role:", error);
      throw new ServerError("DATABASE_ERROR", "Failed to add user role", 500);
    }
  }

  public async removeUserRole(body: RemoveUserRoleRequest): Promise<void> {
    const { userId, roleName } = body;
    const db = this.databaseService.get();

    try {
      await db.transaction(async (tx) => {
        // Check if user exists
        await this.checkUserExists(tx, userId);

        // Get role ID by name
        const roleId = await this.getRoleIdByName(tx, roleName);

        // Remove the role from the user
        const result = await tx
          .delete(userRolesTable)
          .where(
            and(
              eq(userRolesTable.userId, userId),
              eq(userRolesTable.roleId, roleId)
            )
          )
          .returning({ userId: userRolesTable.userId });

        if (result.length === 0) {
          throw new ServerError(
            "ROLE_NOT_FOUND",
            "User does not have this role",
            404
          );
        }
      });
    } catch (error) {
      if (error instanceof ServerError) {
        throw error;
      }
      console.error("Error removing user role:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to remove user role",
        500
      );
    }
  }

  private async checkUserExists(
    tx: NodePgDatabase,
    userId: string
  ): Promise<void> {
    try {
      const users = await tx
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1);

      if (users.length === 0) {
        throw new ServerError("USER_NOT_FOUND", "User not found", 404);
      }
    } catch (error) {
      if (error instanceof ServerError) {
        throw error;
      }

      console.error("Database error while checking user existence:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to verify user existence",
        500
      );
    }
  }

  private async getRoleIdByName(
    tx: NodePgDatabase,
    roleName: string
  ): Promise<number> {
    try {
      const roles = await tx
        .select({ id: rolesTable.id })
        .from(rolesTable)
        .where(eq(rolesTable.name, roleName))
        .limit(1);

      if (roles.length === 0) {
        throw new ServerError("ROLE_NOT_FOUND", "Role not found", 404);
      }

      return roles[0].id;
    } catch (error) {
      if (error instanceof ServerError) {
        throw error;
      }

      console.error("Database error while getting role by name:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to verify role existence",
        500
      );
    }
  }

  private async getOrCreateRoleByName(
    tx: NodePgDatabase,
    roleName: string
  ): Promise<number> {
    try {
      // First, try to find the existing role
      const existingRoles = await tx
        .select({ id: rolesTable.id })
        .from(rolesTable)
        .where(eq(rolesTable.name, roleName))
        .limit(1);

      if (existingRoles.length > 0) {
        return existingRoles[0].id;
      }

      // Role doesn't exist, create it
      const newRoles = await tx
        .insert(rolesTable)
        .values({
          name: roleName,
        })
        .returning({ id: rolesTable.id });

      return newRoles[0].id;
    } catch (error) {
      console.error(
        "Database error while getting or creating role by name:",
        error
      );
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to get or create role",
        500
      );
    }
  }
}
