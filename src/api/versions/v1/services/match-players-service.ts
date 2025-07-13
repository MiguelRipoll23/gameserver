import { inject, injectable } from "@needle-di/core";
import { KVService } from "../../../../core/services/kv-service.ts";
import { BinaryReader } from "../../../../core/utils/binary-reader-utils.ts";
import { WebSocketUser } from "../models/websocket-user.ts";

@injectable()
export class MatchPlayersService {
  private matchPlayers: Map<string, Set<string>>;

  constructor(private kvService = inject(KVService)) {
    this.matchPlayers = new Map();
  }

  public deleteByToken(token: string): void {
    this.matchPlayers.delete(token);
  }

  public async handleMatchPlayerMessage(
    originUser: WebSocketUser,
    binaryReader: BinaryReader,
  ): Promise<void> {
    const isConnected = binaryReader.boolean();
    const playerId = binaryReader.fixedLengthString(32);

    const token = originUser.getToken();
    let players = this.matchPlayers.get(token);
    if (players === undefined) {
      players = new Set<string>();
      this.matchPlayers.set(token, players);
    }

    if (isConnected) {
      players.add(playerId);
    } else {
      players.delete(playerId);
    }

    await this.logPlayerStatus(isConnected, playerId);
  }

  private async logPlayerStatus(
    isConnected: boolean,
    playerId: string,
  ): Promise<void> {
    const user = await this.kvService.getUser(playerId);
    const playerName = user?.displayName ?? playerId;
    const action = isConnected ? "joined" : "left";
    console.log(`Player ${playerName} ${action} match`);
  }
}
