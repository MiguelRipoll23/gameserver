import { inject, injectable } from "@needle-di/core";
import { ServerError } from "../models/server-error.ts";
import { KvService } from "../../../../core/services/kv-service.ts";
import {
  GetVersionResponse,
  GetVersionResponseSchema,
  UpdateVersionRequest,
} from "../schemas/version-schemas.ts";

const GAME_VERSION_KEY = "game_version";

@injectable()
export class VersionService {
  constructor(
    private kvService = inject(KvService),
  ) {}

  private async getInternal(): Promise<Record<string, unknown> | null> {
    const result = await this.kvService.get().get<Record<string, unknown>>([
      GAME_VERSION_KEY,
    ]);
    return result.value;
  }

  private async setInternal(value: Record<string, unknown>): Promise<void> {
    await this.kvService.get().set([GAME_VERSION_KEY], value);
  }

  public async get(): Promise<GetVersionResponse> {
    const response = await this.getInternal();

    if (response === null) {
      throw new ServerError(
        "MISSING_VERSION",
        "Missing version information on the server",
        404
      );
    }

    return GetVersionResponseSchema.parse(response);
  }

  public async set(data: UpdateVersionRequest): Promise<void> {
    await this.setInternal(data as unknown as Record<string, unknown>);
  }
}
