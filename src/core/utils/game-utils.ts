import { ENV_GAME_URL } from "../../api/versions/v1/constants/environment-constants.ts";
import { env } from "cloudflare:workers";

export class GameUtils {
  public static getURL(): string {
    return env[ENV_GAME_URL] ?? "http://localhost:8080";
  }
}
