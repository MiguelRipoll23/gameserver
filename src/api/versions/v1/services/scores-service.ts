import { inject, injectable } from "@needle-di/core";
import { CryptoService } from "../../../../core/services/crypto-service.ts";
import { KVService } from "../../../../core/services/kv-service.ts";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { ServerError } from "../models/server-error.ts";
import {
  GetScoresResponse,
  SaveScoresRequest,
  SaveScoresRequestSchema,
} from "../schemas/scores-schemas.ts";
import {
  userScoresTable,
  usersTable,
  matchesTable,
} from "../../../../db/schema.ts";
import { eq, desc } from "drizzle-orm";

@injectable()
export class ScoresService {
  constructor(
    private cryptoService = inject(CryptoService),
    private kvService = inject(KVService),
    private databaseService = inject(DatabaseService)
  ) {}

  public async list(): Promise<GetScoresResponse> {
    const db = this.databaseService.get();
    const scores = await db
      .select({
        playerName: usersTable.displayName,
        score: userScoresTable.totalScore,
      })
      .from(userScoresTable)
      .innerJoin(usersTable, eq(userScoresTable.userId, usersTable.id))
      .orderBy(desc(userScoresTable.totalScore))
      .limit(10);

    return scores;
  }

  public async save(userId: string, body: ArrayBuffer): Promise<void> {
    // Check if user is hosting a match
    await this.validateUserIsHostingMatch(userId);

    const request = await this.parseAndValidateSaveRequest(userId, body);

    const results = await Promise.allSettled(
      request.map((playerScore) => this.updatePlayerScore(playerScore))
    );

    const failures = results.filter((r) => r.status === "rejected");

    if (failures.length > 0) {
      console.error(`Failed to update ${failures.length} scores`);
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

  private async updatePlayerScore(entry: {
    playerId: string;
    playerName: string;
    score: number;
  }): Promise<void> {
    const { playerId, score } = entry;
    const db = this.databaseService.get();

    // Check if player score exists
    const existingScores = await db
      .select()
      .from(userScoresTable)
      .where(eq(userScoresTable.userId, playerId))
      .limit(1);

    if (existingScores.length > 0) {
      // Update existing score
      const newTotalScore = score + existingScores[0].totalScore;
      await db
        .update(userScoresTable)
        .set({
          totalScore: newTotalScore,
        })
        .where(eq(userScoresTable.userId, playerId));
    } else {
      // Insert new score
      await db.insert(userScoresTable).values({
        userId: playerId,
        totalScore: score,
      });
    }
  }
}
