import { inject, injectable } from "@needle-di/core";
import {
  AdvertiseMatchRequest,
  FindMatchesRequest,
  FindMatchesResponse,
} from "../schemas/matches-schemas.ts";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { ServerError } from "../models/server-error.ts";
import { matchesTable, userSessionsTable } from "../../../../db/schema.ts";
import { and, eq, sql } from "drizzle-orm";

@injectable()
export class MatchesService {
  constructor(private databaseService = inject(DatabaseService)) {}

  public async advertise(
    userId: string,
    body: AdvertiseMatchRequest,
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

    const {
      version,
      totalSlots,
      availableSlots,
      attributes,
      pingMedianMilliseconds,
    } = body;

    try {
      // Use upsert operation to insert or update match
      await db
        .insert(matchesTable)
        .values({
          hostUserId: userId,
          version: version,
          totalSlots: totalSlots,
          availableSlots: availableSlots,
          attributes: attributes ?? {},
          pingMedianMilliseconds: pingMedianMilliseconds ?? 0,
        })
        .onConflictDoUpdate({
          target: matchesTable.hostUserId,
          set: {
            version: version,
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
        500,
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
    if (body.attributes && Object.keys(body.attributes).length > 0) {
      // Ensure all provided attributes are matched in the stored attributes
      conditions.push(
        sql`${matchesTable.attributes} @> ${body.attributes}::jsonb`,
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
        eq(matchesTable.hostUserId, userSessionsTable.userId),
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
        404,
      );
    }

    console.log(`Deleted match for user ${userId}`);
  }
}
