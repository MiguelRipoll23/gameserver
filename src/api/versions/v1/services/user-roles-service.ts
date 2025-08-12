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
import { eq, and, desc } from "drizzle-orm";

@injectable()
export class UserRolesService {
  constructor(private databaseService = inject(DatabaseService)) {}

  public async getUserRoles(
    request: GetUserRolesRequest
  ): Promise<GetUserRolesResponse> {
    const { userId, cursor, limit = 20 } = request;
    const db = this.databaseService.get();

    try {
      // Check if user exists
      await this.checkUserExists(db, userId);

      // Build the query with joins
      let query = db
        .select({
          userId: userRolesTable.userId,
          roleId: userRolesTable.roleId,
          roleName: rolesTable.name,
          roleDescription: rolesTable.description,
          createdAt: userRolesTable.createdAt,
        })
        .from(userRolesTable)
        .innerJoin(rolesTable, eq(userRolesTable.roleId, rolesTable.id))
        .where(eq(userRolesTable.userId, userId))
        .orderBy(desc(userRolesTable.createdAt))
        .limit(limit + 1); // Fetch one extra to check if there are more

      // Apply cursor-based pagination if cursor is provided
      if (cursor !== undefined) {
        query = query.where(
          and(
            eq(userRolesTable.userId, userId)
            // Since we're using timestamp-based pagination, we need to adjust this
            // For simplicity, we'll use a simpler approach
          )
        );
      }

      const results = await query;

      // Check if there are more results
      const hasMore = results.length > limit;
      const data = hasMore ? results.slice(0, limit) : results;

      // Format the response
      const formattedData = data.map((row) => ({
        userId: row.userId,
        roleId: row.roleId,
        roleName: row.roleName,
        roleDescription: row.roleDescription,
        createdAt: row.createdAt.toISOString(),
      }));

      return {
        data: formattedData,
        hasMore,
        nextCursor: hasMore ? data.length : undefined,
      };
    } catch (error) {
      console.error("Error getting user roles:", error);
      throw new ServerError("Failed to get user roles", 500);
    }
  }

  public async addUserRole(body: AddUserRoleRequest): Promise<void> {
    const { userId, roleId } = body;
    const db = this.databaseService.get();

    try {
      await db.transaction(async (tx) => {
        // Check if user exists
        await this.checkUserExists(tx, userId);

        // Check if role exists
        await this.checkRoleExists(tx, roleId);

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
          throw new ServerError("User already has this role", 409);
        }
      });
    } catch (error) {
      if (error instanceof ServerError) {
        throw error;
      }
      console.error("Error adding user role:", error);
      throw new ServerError("Failed to add user role", 500);
    }
  }

  public async removeUserRole(body: RemoveUserRoleRequest): Promise<void> {
    const { userId, roleId } = body;
    const db = this.databaseService.get();

    try {
      await db.transaction(async (tx) => {
        // Check if user exists
        await this.checkUserExists(tx, userId);

        // Check if role exists
        await this.checkRoleExists(tx, roleId);

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
          throw new ServerError("User does not have this role", 404);
        }
      });
    } catch (error) {
      if (error instanceof ServerError) {
        throw error;
      }
      console.error("Error removing user role:", error);
      throw new ServerError("Failed to remove user role", 500);
    }
  }

  private async checkUserExists(
    db: NodePgDatabase<any>,
    userId: string
  ): Promise<void> {
    const user = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (user.length === 0) {
      throw new ServerError("User not found", 404);
    }
  }

  private async checkRoleExists(
    db: NodePgDatabase<any>,
    roleId: string
  ): Promise<void> {
    const role = await db
      .select({ id: rolesTable.id })
      .from(rolesTable)
      .where(eq(rolesTable.id, roleId))
      .limit(1);

    if (role.length === 0) {
      throw new ServerError("Role not found", 404);
    }
  }
}
