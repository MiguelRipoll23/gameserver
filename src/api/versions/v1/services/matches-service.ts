import { inject, injectable } from "@needle-di/core";
import {
  AdvertiseMatchRequest,
  FindMatchesRequest,
  FindMatchesResponse,
} from "../schemas/matches-schemas.ts";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { ServerError } from "../models/server-error.ts";
import {
  matchesTable,
  matchUsersTable,
  userSessionsTable,
  usersTable,
} from "../../../../db/schema.ts";
import { and, eq, sql, inArray } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";

@injectable()
export class MatchesService {
  constructor(private databaseService = inject(DatabaseService)) {}

  public async advertise(
    userId: string,
    body: AdvertiseMatchRequest
  ): Promise<void> {
    const db = this.databaseService.get();
    await this.validateUserSession(db, userId);

    const {
      clientVersion,
      totalSlots,
      usersList,
      attributes,
      pingMedianMilliseconds,
    } = body;

    // Run all validations
    this.validateHostNotInUsersList(userId, usersList);
    this.validateUsersListCapacity(usersList, totalSlots);
    await this.validateUsersExist(db, usersList);
    this.validateSlotConfiguration(usersList, totalSlots);

    // Calculate available slots: total slots minus used slots
    const usedSlots = usersList.length + 1;
    const availableSlots = totalSlots - usedSlots;

    try {
      // Use transaction to ensure match and match_users are created/updated atomically
      await db.transaction(async (tx) => {
        // Use upsert operation to insert or update match
        const [match] = await tx
          .insert(matchesTable)
          .values({
            hostUserId: userId,
            version: clientVersion,
            totalSlots: totalSlots,
            availableSlots: availableSlots,
            attributes: attributes ?? {},
            pingMedianMilliseconds: pingMedianMilliseconds ?? 0,
          })
          .onConflictDoUpdate({
            target: matchesTable.hostUserId,
            set: {
              version: clientVersion,
              totalSlots: totalSlots,
              availableSlots: availableSlots,
              attributes: attributes ?? {},
              pingMedianMilliseconds: pingMedianMilliseconds ?? 0,
              updatedAt: new Date(),
            },
          })
          .returning({ id: matchesTable.id });

        // Populate match_users table
        await this.populateMatchUsers(tx, match.id, usersList);
      });
    } catch (error) {
      console.error("Failed to create match:", error);
      throw new ServerError(
        "MATCH_CREATION_FAILED",
        "Match creation failed",
        500
      );
    }
  }

  public async find(body: FindMatchesRequest): Promise<FindMatchesResponse> {
    const db = this.databaseService.get();
    const limit = body.limit ?? 20; // Default to 20 items per page

    // Build the query conditions
    const conditions = [
      eq(matchesTable.version, body.clientVersion),
      sql`${matchesTable.availableSlots} >= ${body.totalSlots}`,
      sql`${matchesTable.updatedAt} >= NOW() - INTERVAL '5 minutes'`,
    ];

    // Add cursor condition if provided
    if (body.cursor) {
      conditions.push(sql`${matchesTable.id} > ${body.cursor}`);
    }

    // Add attribute conditions using jsonb operators
    if (body.attributes) {
      // Ensure the match contains all requested attributes with matching values
      conditions.push(
        sql`${matchesTable.attributes} @> ${JSON.stringify(
          body.attributes
        )}::jsonb`
      );
    }

    // Get one extra item to determine if there are more results
    const matches = await db
      .select({
        id: matchesTable.id,
        hostUserId: matchesTable.hostUserId,
        version: matchesTable.version,
        totalSlots: matchesTable.totalSlots,
        availableSlots: matchesTable.availableSlots,
        attributes: matchesTable.attributes,
        createdAt: matchesTable.createdAt,
        updatedAt: matchesTable.updatedAt,
        token: userSessionsTable.token,
      })
      .from(matchesTable)
      .innerJoin(
        userSessionsTable,
        eq(matchesTable.hostUserId, userSessionsTable.userId)
      )
      .where(and(...conditions))
      .orderBy(matchesTable.id)
      .limit(limit + 1);

    // Remove the extra item and use it to determine if there are more results
    const hasNextPage = matches.length > limit;
    const results = matches.slice(0, limit);

    // Transform the results into the expected response format
    return {
      results: results.map((match) => ({
        token: match.token,
      })),
      nextCursor: hasNextPage ? matches[matches.length - 1].id : undefined,
      hasMore: hasNextPage,
    };
  }

  public async delete(userId: string): Promise<void> {
    const db = this.databaseService.get();

    const deleted = await db
      .delete(matchesTable)
      .where(eq(matchesTable.hostUserId, userId))
      .returning();

    if (deleted.length === 0) {
      throw new ServerError(
        "MATCH_NOT_FOUND",
        `Match with host user id ${userId} does not exist`,
        404
      );
    }

    console.log(`Deleted match for user ${userId}`);
  }

  /**
   * Validates that a user session exists for the given userId
   */
  private async validateUserSession(
    db: NodePgDatabase,
    userId: string
  ): Promise<void> {
    const session = await db
      .select({ token: userSessionsTable.token })
      .from(userSessionsTable)
      .where(eq(userSessionsTable.userId, userId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!session) {
      throw new ServerError("NO_SESSION_FOUND", "User session not found", 400);
    }
  }

  /**
   * Validates that the host user is not included in the usersList
   */
  private validateHostNotInUsersList(
    hostUserId: string,
    usersList: string[]
  ): void {
    if (usersList.includes(hostUserId)) {
      throw new ServerError(
        "HOST_IN_USERS_LIST",
        "Host user should not be included in the usersList",
        400
      );
    }
  }

  /**
   * Validates that usersList doesn't exceed available capacity
   */
  private validateUsersListCapacity(
    usersList: string[],
    totalSlots: number
  ): void {
    if (usersList.length >= totalSlots) {
      throw new ServerError(
        "INVALID_USERS_LIST",
        "usersList length must be less than totalSlots",
        400
      );
    }
  }

  /**
   * Validates that all user IDs in usersList exist in the users table
   */
  private async validateUsersExist(
    db: NodePgDatabase,
    usersList: string[]
  ): Promise<void> {
    if (usersList.length === 0) return;
    const existingUsers = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(inArray(usersTable.id, usersList));
    const existingUserIds = new Set(existingUsers.map((u) => u.id));
    const missingUserIds = usersList.filter((id) => !existingUserIds.has(id));
    if (missingUserIds.length > 0) {
      throw new ServerError(
        "USER_NOT_FOUND",
        `The following user IDs do not exist: ${missingUserIds.join(", ")}`,
        400
      );
    }
  }

  /**
   * Validates that used slots do not exceed total slots
   */
  private validateSlotConfiguration(
    usersList: string[],
    totalSlots: number
  ): void {
    const usedSlots = usersList.length + 1;
    if (usedSlots > totalSlots) {
      throw new ServerError(
        "INVALID_SLOT_CONFIGURATION",
        "Total slots must be greater than or equal to the number of players including the host",
        400
      );
    }
  }

  /**
   * Populates the match_users table with the list of users participating in the match
   * @param tx Database transaction
   * @param matchId The ID of the match
   * @param usersList Array of user IDs (UUIDs) participating in the match
   */
  private async populateMatchUsers(
    tx: NodePgDatabase,
    matchId: number,
    usersList: string[]
  ): Promise<void> {
    // First, delete existing match users for this match to ensure clean state
    await tx
      .delete(matchUsersTable)
      .where(eq(matchUsersTable.matchId, matchId));

    // Insert new match users if the list is not empty
    if (usersList.length > 0) {
      const matchUsersValues = usersList.map((userId) => ({
        matchId,
        userId,
      }));

      await tx.insert(matchUsersTable).values(matchUsersValues);
    }
  }
}
