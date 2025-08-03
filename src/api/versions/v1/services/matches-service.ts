import { inject, injectable } from "@needle-di/core";
import {
  AdvertiseMatchRequest,
  FindMatchesRequest,
  FindMatchesResponse,
} from "../schemas/matches-schemas.ts";
import { KVService } from "../../../../core/services/kv-service.ts";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { MatchAttributes } from "../interfaces/match-attributes.ts";
import { ServerError } from "../models/server-error.ts";
import { matchesTable, userSessionsTable } from "../../../../db/schema.ts";
import { eq } from "drizzle-orm";
import { MatchEntity } from "../../../../db/tables/matches-table.ts";

@injectable()
export class MatchesService {
  constructor(
    private kvService = inject(KVService),
    private databaseService = inject(DatabaseService)
  ) {}

  public async advertise(
    userId: string,
    body: AdvertiseMatchRequest
  ): Promise<void> {
    // Get the user session from database
    const db = this.databaseService.get();
    const sessions = await db
      .select()
      .from(userSessionsTable)
      .where(eq(userSessionsTable.userId, userId))
      .limit(1);

    if (sessions.length === 0) {
      throw new ServerError("NO_SESSION_FOUND", "User session not found", 400);
    }

    const sessionId = sessions[0].id;
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
    const matches = await db.select().from(matchesTable).limit(50);

    return this.filter(matches, body);
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

  private filter(
    matches: MatchEntity[],
    body: FindMatchesRequest
  ): FindMatchesResponse {
    const results: FindMatchesResponse = [];

    for (const match of matches) {
      if (this.hasAvailableSlots(body, match) === false) {
        continue;
      }

      if (this.hasAttributes(body, match) === false) {
        continue;
      }

      const { sessionId } = match;

      results.push({
        token: sessionId,
      });
    }

    return results;
  }

  private isSameVersion(body: FindMatchesRequest, match: MatchEntity): boolean {
    return body.version === match.version;
  }

  private hasAvailableSlots(
    body: FindMatchesRequest,
    match: MatchEntity
  ): boolean {
    return body.totalSlots <= match.availableSlots;
  }

  private hasAttributes(body: FindMatchesRequest, match: MatchEntity): boolean {
    const matchAttributes = match.attributes as MatchAttributes;

    for (const key in body.attributes) {
      if (key in matchAttributes === false) {
        return false;
      }

      if (body.attributes[key] !== matchAttributes[key]) {
        return false;
      }
    }

    return true;
  }
}
