import { inject, injectable } from "@needle-di/core";
import {
  AdvertiseMatchRequest,
  FindMatchesRequest,
  FindMatchesResponse,
} from "../schemas/matches-schemas.ts";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { ServerError } from "../models/server-error.ts";
import { matchesTable, userSessionsTable } from "../../../../db/schema.ts";
import { eq, and, sql } from "drizzle-orm";

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
      .select({ id: userSessionsTable.id })
      .from(userSessionsTable)
      .where(eq(userSessionsTable.userId, userId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!session) {
      throw new ServerError("NO_SESSION_FOUND", "User session not found", 400);
    }

    const sessionId = session.id;
    const { version, totalSlots, availableSlots, attributes } = body;

    try {
      // Use upsert operation to insert or update match
      await db
        .insert(matchesTable)
        .values({
          sessionId: sessionId,
          hostUserId: userId,
          version: version,
          totalSlots: totalSlots,
          availableSlots: availableSlots,
          attributes: attributes ?? {},
        })
        .onConflictDoUpdate({
          target: matchesTable.hostUserId,
          set: {
            sessionId: sessionId,
            version: version,
            totalSlots: totalSlots,
            availableSlots: availableSlots,
            attributes: attributes ?? {},
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

  public async find(body: FindMatchesRequest): Promise<FindMatchesResponse> {
    const db = this.databaseService.get();
    const limit = body.limit ?? 20; // Default to 20 items per page

    // Build the query conditions
    const conditions = [
      eq(matchesTable.version, body.version),
      sql`${matchesTable.availableSlots} >= ${body.totalSlots}`,
      sql`${matchesTable.updatedAt} >= NOW() - INTERVAL '5 minutes'`,
    ];

    // Add cursor condition if provided
    if (body.cursor) {
      conditions.push(sql`${matchesTable.id} > ${body.cursor}`);
    }

    // Add attribute conditions using jsonb operators
    if (body.attributes) {
      for (const [key, value] of Object.entries(body.attributes)) {
        // Use ->> operator for exact value match (handles non-existent keys gracefully)
        conditions.push(
          sql`${matchesTable.attributes}->>${key} = ${JSON.stringify(value)}`
        );
      }
    }

    // Get one extra item to determine if there are more results
    const matches = await db
      .select()
      .from(matchesTable)
      .where(and(...conditions))
      .orderBy(matchesTable.id)
      .limit(limit + 1);

    // Remove the extra item and use it to determine if there are more results
    const hasNextPage = matches.length > limit;
    const results = matches.slice(0, limit);

    // Transform the results into the expected response format
    return {
      data: results.map((match) => ({
        id: match.id,
        token: match.sessionId,
        totalSlots: match.totalSlots,
        availableSlots: match.availableSlots,
        attributes: match.attributes as Record<string, unknown>,
        createdAt: match.createdAt.toISOString(),
      })),
      nextCursor: hasNextPage ? results[results.length - 1].id : undefined,
    };
  }

  public async delete(userId: string): Promise<void> {
    const db = this.databaseService.get();

    try {
      await db.delete(matchesTable).where(eq(matchesTable.hostUserId, userId));

      console.log(`Deleted match for user ${userId}`);
    } catch (error) {
      console.error("Failed to delete match:", error);
      throw new ServerError(
        "MATCH_DELETION_FAILED",
        "Match deletion failed",
        500
      );
    }
  }
}
