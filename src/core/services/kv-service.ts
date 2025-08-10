import { injectable } from "@needle-di/core";

@injectable()
export class BaseKVService {
  private kv: Deno.Kv | null = null;

  public async init(): Promise<void> {
    this.kv = await Deno.openKv();
    console.log("KV connection opened");
  }

  public getKv(): Deno.Kv {
    if (this.kv === null) {
      throw new Error("KV not initialized");
    }

    return this.kv;
  }
}
