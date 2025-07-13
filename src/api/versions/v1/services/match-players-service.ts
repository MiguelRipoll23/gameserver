import { injectable } from "@needle-di/core";
import { BinaryReader } from "../../../../core/utils/binary-reader-utils.ts";
import { WebSocketUser } from "../models/websocket-user.ts";

@injectable()
export class MatchPlayersService {
  private matchPlayers: Map<string, Set<string>>;

  constructor() {
    this.matchPlayers = new Map();
  }

  public deleteByToken(token: string): void {
    this.matchPlayers.delete(token);
  }

  public getPlayers(matchId: string): Set<string> | undefined {
    return this.matchPlayers.get(matchId);
  }

  public updateMatchPlayers(
    matchId: string,
    playerId: string,
    isConnected: boolean,
  ): void {
    let players = this.matchPlayers.get(matchId);
    if (players === undefined) {
      players = new Set<string>();
      this.matchPlayers.set(matchId, players);
    }

    if (isConnected) {
      players.add(playerId);
    } else {
      players.delete(playerId);
      if (players.size === 0) {
        this.matchPlayers.delete(matchId);
      }
    }
  }

  public handleMatchPlayerMessage(
    originUser: WebSocketUser,
    binaryReader: BinaryReader,
  ): void {
    const isConnected = binaryReader.boolean();
    const playerId = binaryReader.fixedLengthString(32);

    const matchId = originUser.getToken();
    this.updateMatchPlayers(matchId, playerId, isConnected);

    const action = isConnected ? "joined" : "left";
    console.log(`Player ${playerId} ${action} match ${matchId}`);
  }
}
