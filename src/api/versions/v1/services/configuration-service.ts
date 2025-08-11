import { inject, injectable } from "@needle-di/core";
import { ServerError } from "../models/server-error.ts";
import { CryptoService } from "./crypto-service.ts";
import {
  GetConfigurationResponse,
  UpdateConfigurationRequest,
} from "../schemas/configuration-schemas.ts";
import { KVService } from "./kv-service.ts";

@injectable()
export class ConfigurationService {
  constructor(
    private kvService = inject(KVService),
    private cryptoService = inject(CryptoService)
  ) {}

  public async getData(): Promise<GetConfigurationResponse> {
    const configuration = await this.kvService.getConfiguration();

    if (configuration === null) {
      throw new ServerError(
        "CONFIGURATION_NOT_FOUND",
        "Configuration not found",
        404
      );
    }

    return configuration;
  }

  public async setData(
    configurationRequest: UpdateConfigurationRequest
  ): Promise<void> {
    await this.kvService.setConfiguration(configurationRequest);
  }

  public async getBlob(userId: string): Promise<ArrayBuffer> {
    const configuration = await this.kvService.getConfiguration();

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
