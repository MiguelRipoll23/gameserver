import { inject, injectable } from "@needle-di/core";
import { ServerError } from "../models/server-error.ts";
import { CryptoService } from "./crypto-service.ts";
import {
  GetConfigurationResponse,
  UpdateConfigurationRequest,
} from "../schemas/configuration-schemas.ts";
import { GameConfigurationService } from "./game-configuration-service.ts";

const CLOUD_CONFIGURATION_KEY = "cloud_configuration";

@injectable()
export class ConfigurationService {
  constructor(
    private gameConfigurationService = inject(GameConfigurationService),
    private cryptoService = inject(CryptoService)
  ) {}

  public async getData(): Promise<GetConfigurationResponse> {
    const configuration = await this.gameConfigurationService.get(
      CLOUD_CONFIGURATION_KEY,
    );

    if (configuration === null) {
      throw new ServerError(
        "CONFIGURATION_NOT_FOUND",
        "Configuration not found",
        404
      );
    }

    return configuration as unknown as GetConfigurationResponse;
  }

  public async setData(
    configurationRequest: UpdateConfigurationRequest
  ): Promise<void> {
    await this.gameConfigurationService.save(
      CLOUD_CONFIGURATION_KEY,
      configurationRequest as unknown as Record<string, unknown>,
    );
  }

  public async getBlob(userId: string): Promise<ArrayBuffer> {
    const configuration = await this.gameConfigurationService.get(
      CLOUD_CONFIGURATION_KEY,
    );

    if (configuration === null) {
      throw new ServerError(
        "CONFIGURATION_NOT_FOUND",
        "Configuration not found",
        404
      );
    }

    const data = JSON.stringify(configuration);
    const encoded = new TextEncoder().encode(data);
    const rawData = encoded.slice().buffer;
    const encryptedData = await this.cryptoService.encryptForUser(
      userId,
      rawData
    );

    return encryptedData;
  }
}
