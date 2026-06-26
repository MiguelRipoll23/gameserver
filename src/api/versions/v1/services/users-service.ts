import { inject, injectable } from "@needle-di/core";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { ServerError } from "../models/server-error.ts";
import {
  rolesTable,
  userRolesTable,
  usersTable,
} from "../../../../db/schema.ts";
import { eq } from "drizzle-orm";
import type { UserEntity } from "../../../../db/tables/users-table.ts";

@injectable()
export class UsersService {
  constructor(private databaseService = inject(DatabaseService)) {}

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
      console.error("Failed to query user:", error);
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
      console.error("Failed to query user roles:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to retrieve user roles",
        500,
      );
    }
  }
}
