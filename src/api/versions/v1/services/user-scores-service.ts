import { inject, injectable } from "@needle-di/core";
import { CryptoService } from "./crypto-service.ts";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { ServerError } from "../models/server-error.ts";
import {
  GetScoresResponse,
  SaveScoresRequest,
  SaveScoresRequestSchema,
} from "../schemas/scores-schemas.ts";
import { PaginationParams } from "../schemas/pagination-schemas.ts";
import {
  userScoresTable,
  usersTable,
  matchesTable,
} from "../../../../db/schema.ts";
import { eq, desc, sql, gt } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";

@injectable()
export class UserScoresService {
  constructor(
    private cryptoService = inject(CryptoService),
    private databaseService = inject(DatabaseService)
  ) {}

  public async list(
    params: Partial<PaginationParams> = {}
  ): Promise<GetScoresResponse> {
    const { cursor, limit = 20 } = params;
    const db = this.databaseService.get();

    // Build query conditions
    const conditions = [];

    // If cursor is provided, get records with id greater than cursor
    // This works well with the id field for pagination
    if (cursor !== undefined) {
      conditions.push(gt(userScoresTable.id, cursor));
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
      nextCursor: hasNextPage ? results[results.length - 1].id : undefined,
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
}
