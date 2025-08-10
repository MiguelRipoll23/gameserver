import { injectable } from "@needle-di/core";
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

  public removePlayerFromAllMatches(playerId: string): void {
    // Remove the player from all matches and clean up empty matches
    for (const [token, players] of this.matchPlayers.entries()) {
      if (players.has(playerId)) {
        players.delete(playerId);
        console.log(`Removed player ${playerId} from match ${token}`);

        // If the match has no players left, remove it entirely
        if (players.size === 0) {
          this.matchPlayers.delete(token);
          console.log(`Deleted empty match ${token}`);
        }
      }
    }
  }

  public getPlayersByToken(token: string): string[] {
    const players = this.matchPlayers.get(token);

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
      if (players.size === 0) {
        this.matchPlayers.delete(token);
      }
    }

    const action = isConnected ? "joined" : "left";
    console.log(`Player ${playerId} ${action} match ${token}`);
  }
}
