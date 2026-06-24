import { injectable } from "@needle-di/core";
import { Env } from "../types/env-type.ts";

@injectable()
export class EnvService {
  private env: Env | null = null;

  public init(env: Env): void {
    this.env = env;
  }

  public get<T = string>(key: keyof Env): T {
    if (this.env === null) {
      throw new Error("EnvService not initialized");
    }
    return this.env[key] as T;
  }

  public getAll(): Env {
    if (this.env === null) {
      throw new Error("EnvService not initialized");
    }
    return this.env;
  }

  public getDurableObjectNamespace(): DurableObjectNamespace {
    return this.get<DurableObjectNamespace>("GAME_SERVER_DO");
  }
}
