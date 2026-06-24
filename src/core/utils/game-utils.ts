export class GameUtils {
  public static getURL(gameUrl?: string): string {
    return gameUrl ?? "http://localhost:8080";
  }
}
