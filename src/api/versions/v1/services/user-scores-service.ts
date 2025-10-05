import { inject, injectable } from "@needle-di/core";
import { CryptoService } from "./crypto-service.ts";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { ServerError } from "../models/server-error.ts";
import {
  GetScoresResponse,
  SaveScoresRequest,
  SaveScoresRequestSchema,
} from "../schemas/scores-schemas.ts";
import { StringPaginationParams } from "../schemas/pagination-schemas.ts";
import {
  userScoresTable,
  usersTable,
  matchesTable,
} from "../../../../db/schema.ts";
import { eq, desc, sql, gt, or, and, lt } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";

@injectable()
export class UserScoresService {
  constructor(
    private cryptoService = inject(CryptoService),
    private databaseService = inject(DatabaseService)
  ) {}

  public async list(
    params: Partial<StringPaginationParams> = {}
  ): Promise<GetScoresResponse> {
    const { cursor, limit = 20 } = params;
    const db = this.databaseService.get();

    // Build query conditions
    const conditions = [];

    // If cursor is provided, decode it and use for keyset pagination
    if (cursor !== undefined) {
      const { totalScore, id } = this.decodeCursor(cursor);
      // For ORDER BY totalScore DESC, id ASC:
      // Get records where totalScore < cursorScore OR (totalScore = cursorScore AND id > cursorId)
      conditions.push(
        or(
          lt(userScoresTable.totalScore, totalScore),
          and(
            eq(userScoresTable.totalScore, totalScore),
            gt(userScoresTable.id, id)
          )
        )
      );
    }

    // Get one extra item to determine if there are more results
    const scores = await db
      .select({
        id: userScoresTable.id,
        userDisplayName: usersTable.displayName,
        totalScore: userScoresTable.totalScore,
      })
      .from(userScoresTable)
      .innerJoin(usersTable, eq(userScoresTable.userId, usersTable.id))
      .where(conditions.length > 0 ? conditions[0] : undefined)
      .orderBy(desc(userScoresTable.totalScore), userScoresTable.id)
      .limit(limit + 1);

    // Remove the extra item and use it to determine if there are more results
    const hasNextPage = scores.length > limit;
    const results = scores.slice(0, limit);

    return {
      results: results.map((score) => ({
        userDisplayName: score.userDisplayName,
        totalScore: score.totalScore,
      })),
      nextCursor: hasNextPage
        ? this.encodeCursor(
            results[results.length - 1].totalScore,
            results[results.length - 1].id
          )
        : undefined,
      hasMore: hasNextPage,
    };
  }

  public async save(userId: string, body: ArrayBuffer): Promise<void> {
    // Check if user is hosting a match
    await this.validateUserIsHostingMatch(userId);

    const request = await this.parseAndValidateSaveRequest(userId, body);
    console.debug("SaveScoresRequest", request);

    // Use database transaction to ensure atomicity
    const db = this.databaseService.get();

    try {
      await db.transaction(async (tx) => {
        // Update all player scores within a single transaction
        for (const playerScore of request) {
          await this.updateWithTransaction(
            tx,
            playerScore.userId,
            playerScore.totalScore
          );
        }
      });
    } catch (error) {
      console.error("Failed to update scores in transaction:", error);
      throw new ServerError(
        "SCORE_UPDATE_FAILED",
        "Failed to update player scores",
        500
      );
    }
  }

  private async validateUserIsHostingMatch(userId: string): Promise<void> {
    const db = this.databaseService.get();

    const hostedMatches = await db
      .select()
      .from(matchesTable)
      .where(eq(matchesTable.hostUserId, userId))
      .limit(1);

    if (hostedMatches.length === 0) {
      throw new ServerError(
        "NOT_HOSTING_MATCH",
        "Only match hosts can save scores",
        400
      );
    }
  }

  private async parseAndValidateSaveRequest(
    userId: string,
    body: ArrayBuffer
  ): Promise<SaveScoresRequest> {
    try {
      const decrypted = await this.cryptoService.decryptForUser(userId, body);
      const json = new TextDecoder().decode(decrypted);

      return SaveScoresRequestSchema.parse(JSON.parse(json));
    } catch (error) {
      console.error("Failed to parse and validate SaveScoresRequest:", error);
      throw new ServerError("BAD_REQUEST", "Invalid request body", 400);
    }
  }

  private async updateWithTransaction(
    tx: NodePgDatabase,
    userId: string,
    totalScore: number
  ): Promise<void> {
    // Atomic upsert: insert or increment totalScore on conflict
    await tx
      .insert(userScoresTable)
      .values({
        userId,
        totalScore,
      })
      .onConflictDoUpdate({
        target: userScoresTable.userId,
        set: {
          totalScore: sql`${userScoresTable.totalScore} + EXCLUDED.total_score`,
        },
      });
  }

  /**
   * Encodes a composite cursor for pagination based on totalScore and id
   * @param totalScore The score value
   * @param id The ID value
   * @returns Base64 encoded cursor string
   */
  private encodeCursor(totalScore: number, id: number): string {
    const cursorData = { totalScore, id };
    const encoder = new TextEncoder();
    const encoded = encoder.encode(JSON.stringify(cursorData));
    return btoa(String.fromCharCode(...encoded));
  }

  /**
   * Decodes a composite cursor for pagination
   * @param cursor Base64 encoded cursor string
   * @returns Object with totalScore and id values
   */
  private decodeCursor(cursor: string): { totalScore: number; id: number } {
    try {
      const decoded = atob(cursor);
      const decoder = new TextDecoder();
      const bytes = new Uint8Array(
        decoded.split("").map((char) => char.charCodeAt(0))
      );
      const jsonString = decoder.decode(bytes);
      const cursorData = JSON.parse(jsonString);

      if (
        typeof cursorData.totalScore !== "number" ||
        typeof cursorData.id !== "number"
      ) {
        throw new Error("Invalid cursor format");
      }

      return cursorData;
    } catch (_error) {
      throw new ServerError(
        "INVALID_CURSOR",
        "Invalid pagination cursor format",
        400
      );
    }
  }
}
