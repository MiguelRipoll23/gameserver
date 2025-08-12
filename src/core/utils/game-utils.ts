import { ENV_GAME_URL } from "../../api/versions/v1/constants/environment-constants.ts";

export class GameUtils {
  public static getURL(): string {
    return Deno.env.get(ENV_GAME_URL) ?? "http://localhost:8080";
  }
}
