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
import { eq, and, desc, or, lt } from "drizzle-orm";
import { Buffer } from "node:buffer";

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

      // Decode cursor if provided
      let cursorTimestamp: Date | null = null;
      let cursorRoleId: string | null = null;

      if (cursor !== undefined) {
        try {
          const decoded = this.decodeCursor(cursor);
          cursorTimestamp = decoded.timestamp;
          cursorRoleId = decoded.roleId;
        } catch (error) {
          // Invalid cursor, fall back to first page
          console.warn(
            "Invalid cursor provided, falling back to first page:",
            error
          );
        }
      }

      // Build the query with joins
      const whereConditions = [eq(userRolesTable.userId, userId)];

      // Apply cursor-based pagination if cursor is provided and valid
      if (cursorTimestamp && cursorRoleId) {
        whereConditions.push(
          or(
            lt(userRolesTable.createdAt, cursorTimestamp)!,
            and(
              eq(userRolesTable.createdAt, cursorTimestamp),
              lt(userRolesTable.roleId, cursorRoleId)
            )!
          )!
        );
      }

      const query = db
        .select({
          userId: userRolesTable.userId,
          roleId: userRolesTable.roleId,
          roleName: rolesTable.name,
          roleDescription: rolesTable.description,
          createdAt: userRolesTable.createdAt,
        })
        .from(userRolesTable)
        .innerJoin(rolesTable, eq(userRolesTable.roleId, rolesTable.id))
        .where(and(...whereConditions))
        .orderBy(desc(userRolesTable.createdAt), userRolesTable.roleId)
        .limit(limit + 1); // Fetch one extra to check if there are more

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

      // Generate next cursor if there are more results
      let nextCursor: string | undefined;
      if (hasMore && data.length > 0) {
        const lastItem = data[data.length - 1];
        nextCursor = this.encodeCursor(lastItem.createdAt, lastItem.roleId);
      }

      return {
        data: formattedData,
        hasMore,
        nextCursor,
      };
    } catch (error) {
      console.error("Error getting user roles:", error);
      throw new ServerError("DATABASE_ERROR", "Failed to get user roles", 500);
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

  /**
   * Encodes a cursor from timestamp and roleId for stable pagination
   */
  private encodeCursor(timestamp: Date, roleId: string): string {
    const cursor = {
      timestamp: timestamp.getTime(),
      roleId: roleId,
    };
    return Buffer.from(JSON.stringify(cursor)).toString("base64");
  }

  /**
   * Decodes a cursor to extract timestamp and roleId
   */
  private decodeCursor(cursor: string): { timestamp: Date; roleId: string } {
    try {
      const decoded = JSON.parse(
        Buffer.from(cursor, "base64").toString("utf-8")
      );

      if (!decoded.timestamp || !decoded.roleId) {
        throw new Error("Invalid cursor format: missing timestamp or roleId");
      }

      return {
        timestamp: new Date(decoded.timestamp),
        roleId: decoded.roleId,
      };
    } catch (error) {
      throw new Error(
        `Failed to decode cursor: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  private async checkUserExists(
    db: NodePgDatabase<Record<string, never>>,
    userId: string
  ): Promise<void> {
    const user = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (user.length === 0) {
      throw new ServerError("USER_NOT_FOUND", "User not found", 404);
    }
  }

  private async checkRoleExists(
    db: NodePgDatabase<Record<string, never>>,
    roleId: string
  ): Promise<void> {
    const role = await db
      .select({ id: rolesTable.id })
      .from(rolesTable)
      .where(eq(rolesTable.id, roleId))
      .limit(1);

    if (role.length === 0) {
      throw new ServerError("ROLE_NOT_FOUND", "Role not found", 404);
    }
  }
}
