import { injectable } from "@needle-di/core";
import { WebSocketUser } from "../models/websocket-user.ts";

@injectable()
export class MatchPlayersService {
  private matchPlayers: Map<string, Set<string>>;

  constructor() {
    this.matchPlayers = new Map();
  }

  public deleteBySessionId(sessionId: string): void {
    this.matchPlayers.delete(sessionId);
  }

  public getPlayersBySessionId(sessionId: string): string[] {
    const players = this.matchPlayers.get(sessionId);

    if (players === undefined) {
      return [];
    }

    return Array.from(players);
  }

  public handleMatchPlayerMessage(
    originUser: WebSocketUser,
    isConnected: boolean,
    playerId: string
  ): void {
    const sessionId = originUser.getSessionId();

    let players = this.matchPlayers.get(sessionId);

    if (players === undefined) {
      players = new Set<string>();
      this.matchPlayers.set(sessionId, players);
    }

    if (isConnected) {
      players.add(playerId);
    } else {
      players.delete(playerId);
      if (players.size === 0) {
        this.matchPlayers.delete(sessionId);
      }
    }

    const action = isConnected ? "joined" : "left";
    console.log(`Player ${playerId} ${action} match ${sessionId}`);
  }
}
