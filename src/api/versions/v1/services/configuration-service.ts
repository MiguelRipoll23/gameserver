import { inject, injectable } from "@needle-di/core";
import { ServerError } from "../models/server-error.ts";
import { CryptoService } from "./crypto-service.ts";
import { KvService } from "../../../../core/services/kv-service.ts";
import {
  GetConfigurationResponse,
  GetConfigurationResponseSchema,
  UpdateConfigurationRequest,
} from "../schemas/configuration-schemas.ts";

const CLOUD_CONFIGURATION_KEY = "cloud_configuration";

@injectable()
export class ConfigurationService {
  constructor(
    private kvService = inject(KvService),
    private cryptoService = inject(CryptoService),
  ) {}

  public async get(): Promise<GetConfigurationResponse> {
    const result = await this.kvService.get().get<Record<string, unknown>>([
      CLOUD_CONFIGURATION_KEY,
    ]);

    if (result.value === null) {
      throw new ServerError(
        "CONFIGURATION_NOT_FOUND",
        "Configuration not found",
        404
      );
    }

    return GetConfigurationResponseSchema.parse(result.value);
  }

  public async set(
    configurationRequest: UpdateConfigurationRequest
  ): Promise<void> {
    await this.kvService.get().set(
      [CLOUD_CONFIGURATION_KEY],
      configurationRequest as unknown as Record<string, unknown>,
    );
  }

  public async getBlob(userId: string): Promise<ArrayBuffer> {
    const result = await this.kvService.get().get<Record<string, unknown>>([
      CLOUD_CONFIGURATION_KEY,
    ]);

    if (result.value === null) {
      throw new ServerError(
        "CONFIGURATION_NOT_FOUND",
        "Configuration not found",
        404
      );
    }

    const data = JSON.stringify(result.value);
    const encoded = new TextEncoder().encode(data);
    const rawData = encoded.slice().buffer;
    const encryptedData = await this.cryptoService.encryptForUser(
      userId,
      rawData
    );

    return encryptedData;
  }
}
