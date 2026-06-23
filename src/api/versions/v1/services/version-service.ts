import { inject, injectable } from "@needle-di/core";
import { ServerError } from "../models/server-error.ts";
import {
  GetVersionResponse,
  GetVersionResponseSchema,
  UpdateVersionRequest,
} from "../schemas/version-schemas.ts";
import { GameConfigurationService } from "./game-configuration-service.ts";

const VERSION_KEY = "version";

@injectable()
export class VersionService {
  constructor(
    private gameConfigurationService = inject(GameConfigurationService),
  ) {}

  public async get(): Promise<GetVersionResponse> {
    const response = await this.gameConfigurationService.get(VERSION_KEY);

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
    await this.gameConfigurationService.save(
      VERSION_KEY,
      data,
    );
  }
}
