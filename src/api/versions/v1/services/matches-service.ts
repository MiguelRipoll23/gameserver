import { inject, injectable } from "@needle-di/core";
import {
  AdvertiseMatchRequest,
  FindMatchesRequest,
  FindMatchesResponse,
} from "../schemas/matches-schemas.ts";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { ServerError } from "../models/server-error.ts";
import { matchesTable, matchUsersTable, userSessionsTable } from "../../../../db/schema.ts";
import { and, eq, sql } from "drizzle-orm";

@injectable()
export class MatchesService {
  constructor(private databaseService = inject(DatabaseService)) {}

  public async advertise(
    userId: string,
    body: AdvertiseMatchRequest
  ): Promise<void> {
    // Get the user session from database
    const db = this.databaseService.get();
    const session = await db
      .select({ token: userSessionsTable.token })
      .from(userSessionsTable)
      .where(eq(userSessionsTable.userId, userId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!session) {
      throw new ServerError("NO_SESSION_FOUND", "User session not found", 400);
    }

    const availableSlots = this.calculateAvailableSlots(
      body.playerList,
      body.totalSlots
    );

    await this.upsertMatch(userId, body, availableSlots);
    await this.updateMatchUsers(userId, body.usersList);
  }

  private calculateAvailableSlots(
    playerList: string[],
    totalSlots: number
  ): number {
    // Validate playerList has at least 1 player (the host)
    // Note: The host must always be included in the playerList
    if (playerList.length === 0) {
      throw new ServerError(
        "INVALID_PLAYER_LIST",
        "Player list must contain at least one player (the host)",
        400
      );
    }

    // Calculate available slots by subtracting non-host players count
    // playerList.length - 1 excludes the host from the count
    const playersCount = playerList.length - 1;
    const availableSlots = totalSlots - playersCount;

    // Ensure available slots is not negative
    if (availableSlots < 0) {
      throw new ServerError(
        "TOO_MANY_PLAYERS",
        "Number of players exceeds total slots",
        400
      );
    }

    return availableSlots;
  }

  private async upsertMatch(
    userId: string,
    body: AdvertiseMatchRequest,
    availableSlots: number
  ): Promise<void> {
    const db = this.databaseService.get();
    const {
      clientVersion,
      totalSlots,
      attributes,
      pingMedianMilliseconds,
    } = body;

    try {
      // Use upsert operation to insert or update match
      await db
        .insert(matchesTable)
        .values({
          hostUserId: userId,
          clientVersion: clientVersion,
          totalSlots: totalSlots,
          availableSlots: availableSlots,
          attributes: attributes ?? {},
          pingMedianMilliseconds: pingMedianMilliseconds ?? 0,
        })
        .onConflictDoUpdate({
          target: matchesTable.hostUserId,
          set: {
            clientVersion: clientVersion,
            totalSlots: totalSlots,
            availableSlots: availableSlots,
            attributes: attributes ?? {},
            pingMedianMilliseconds: pingMedianMilliseconds ?? 0,
            updatedAt: new Date(),
          },
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

  private async updateMatchUsers(
    userId: string,
    usersList: string[]
  ): Promise<void> {
    const db = this.databaseService.get();

    // Get the match ID for this host
    const match = await db
      .select({ id: matchesTable.id })
      .from(matchesTable)
      .where(eq(matchesTable.hostUserId, userId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!match) {
      console.error(`Match not found after upsert for user ${userId}`);
      throw new ServerError(
        "MATCH_UPSERT_FAILED",
        "Match not found after upsert",
        500
      );
    }

    // Use transaction to ensure atomicity of delete-then-insert operation
    await db.transaction(async (tx) => {
      // Delete existing match users
      await tx
        .delete(matchUsersTable)
        .where(eq(matchUsersTable.matchId, match.id));

      // Insert new match users if any
      if (usersList.length > 0) {
        await tx.insert(matchUsersTable).values(
          usersList.map((uid) => ({
            matchId: match.id,
            userId: uid,
          }))
        );
      }
    });
  }

  public async find(body: FindMatchesRequest): Promise<FindMatchesResponse> {
    const db = this.databaseService.get();
    const limit = body.limit ?? 20; // Default to 20 items per page

    // Build the query conditions
    const conditions = [
      eq(matchesTable.clientVersion, body.clientVersion),
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
        clientVersion: matchesTable.clientVersion,
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
}
