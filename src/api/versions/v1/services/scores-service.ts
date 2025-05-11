import { inject, injectable } from "@needle-di/core";
import { ScoreKV } from "../interfaces/kv/score.ts";
import { CryptoService } from "../../../../core/services/crypto-service.ts";
import { KVService } from "../../../../core/services/kv-service.ts";
import {
  GetScoresResponse,
  SaveScoreRequest,
  SaveScoreRequestSchema,
} from "../schemas/scores-schemas.ts";
import { ServerError } from "../models/server-error.ts";

@injectable()
export class ScoresService {
  constructor(
    private cryptoService = inject(CryptoService),
    private kvService = inject(KVService),
  ) {}

  public async list(): Promise<GetScoresResponse> {
    const entries: Deno.KvListIterator<ScoreKV> = this.kvService.listScores();
    const scores: GetScoresResponse = [];

    for await (const entry of entries) {
      const playerName = entry.value.player_name;
      const score = entry.value.score;
      scores.push({ player_name: playerName, score });
    }

    scores.sort((a: ScoreKV, b: ScoreKV) => b.score - a.score);

    return scores.slice(0, 10);
  }

  public async save(
    userId: string,
    userName: string,
    body: ArrayBuffer,
  ): Promise<void> {
    const decryptedBody = await this.cryptoService.decryptForUser(userId, body);

    let request: SaveScoreRequest | null = null;

    try {
      request = SaveScoreRequestSchema.parse(
        JSON.parse(new TextDecoder().decode(decryptedBody)),
      );
    } catch (error) {
      console.error(error);
      throw new ServerError("BAD_REQUEST", "Invalid body", 400);
    }

    const { score } = request;

    const scoreKV: ScoreKV = {
      player_name: userName,
      score,
    };

    await this.kvService.setScore(userName, scoreKV);
  }
}
