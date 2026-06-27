import { injectable } from "@needle-di/core";
import { ServerError } from "../../api/versions/v1/models/server-error.ts";

@injectable()
export class KvService {
  private kv: Deno.Kv | null = null;

  public async init(): Promise<void> {
    this.kv = await Deno.openKv();
    console.log("KV store opened");
  }

  public get(): Deno.Kv {
    if (this.kv === null) {
      throw new ServerError(
        "KV_NOT_INITIALIZED",
        "KV store has not been initialized",
        500,
      );
    }

    return this.kv;
  }
}
