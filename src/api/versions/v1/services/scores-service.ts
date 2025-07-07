import { inject, injectable } from "@needle-di/core";
import { CryptoService } from "../../../../core/services/crypto-service.ts";
import { KVService } from "../../../../core/services/kv-service.ts";
import { NotificationService } from "./notification-service.ts";
import { ScoreKV } from "../interfaces/kv/score.ts";
import { ServerError } from "../models/server-error.ts";
import {
  GetScoresResponse,
  SaveScoresRequest,
  SaveScoresRequestSchema,
} from "../schemas/scores-schemas.ts";

@injectable()
export class ScoresService {
  constructor(
    private cryptoService = inject(CryptoService),
    private kvService = inject(KVService),
    private notificationService = inject(NotificationService)
  ) {}

  public async list(): Promise<GetScoresResponse> {
    const entries = this.kvService.listScores();
    const scores: GetScoresResponse = [];

    for await (const entry of entries) {
      const { playerName, score } = entry.value;
      scores.push({ playerName, score });
    }

    scores.sort((a, b) => b.score - a.score);

    return scores.slice(0, 10);
  }

  public async save(userId: string, body: ArrayBuffer): Promise<void> {
    const match = await this.kvService.getMatch(userId);

    if (match === null) {
      throw new ServerError(
        "NO_MATCH_FOUND",
        "User is not hosting a match",
        400
      );
    }

    const request = await this.parseAndValidateSaveRequest(userId, body);

    const results = await Promise.allSettled(
      request.map((playerScore) => this.updatePlayerScore(playerScore))
    );

    const failures = results.filter((r) => r.status === "rejected");

    if (failures.length > 0) {
      console.error(`Failed to update ${failures.length} scores`);
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
    const { playerId, playerName, score } = entry;
    const existing = await this.kvService.getScore(playerId);
    const totalScore = score + (existing?.score ?? 0);

    const highestBefore = await this.getHighestScore();

    const newScore: ScoreKV = { playerId, playerName, score: totalScore };
    await this.kvService.setScore(playerId, newScore);

    if (
      (highestBefore === null || highestBefore.playerId !== playerId) &&
      (highestBefore === null || totalScore > highestBefore.score)
    ) {
      this.notificationService.notifyUser(
        playerId,
        "You have the highest score!",
      );
    }
  }

  private async getHighestScore(): Promise<ScoreKV | null> {
    let highest: ScoreKV | null = null;
    const entries = this.kvService.listScores();

    for await (const entry of entries) {
      if (highest === null || entry.value.score > highest.score) {
        highest = entry.value;
      }
    }

    return highest;
  }
}
