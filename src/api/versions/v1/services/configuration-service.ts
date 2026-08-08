import { inject, injectable } from "@needle-di/core";
import { ServerError } from "../models/server-error.ts";
import { CryptoService } from "./crypto-service.ts";
import {
  GetConfigurationResponse,
  UpdateConfigurationRequest,
} from "../schemas/configuration-schemas.ts";
import { GameConfigurationService } from "./game-configuration-service.ts";
import { getHubStub } from "../../../../core/utils/environment.ts";
import { Base64Utils } from "../../../../core/utils/base64-utils.ts";

const CLOUD_CONFIGURATION_KEY = "cloud_configuration";
const ANTI_CHEAT_CONFIG_KEY = "4030BF2F";

@injectable()
export class ConfigurationService {
  constructor(
    private gameConfigurationService = inject(GameConfigurationService),
    private cryptoService = inject(CryptoService),
  ) {}

  public async getData(): Promise<GetConfigurationResponse> {
    const configuration = await this.gameConfigurationService.get(
      CLOUD_CONFIGURATION_KEY,
    );

    if (configuration === null) {
      throw new ServerError(
        "CONFIGURATION_NOT_FOUND",
        "Configuration not found",
        404,
      );
    }

    return configuration as unknown as GetConfigurationResponse;
  }

  public async setData(
    configurationRequest: UpdateConfigurationRequest,
  ): Promise<void> {
    await this.gameConfigurationService.save(
      CLOUD_CONFIGURATION_KEY,
      configurationRequest as unknown as Record<string, unknown>,
    );

    // If the configuration contains anti-cheat rules, push them to all
    // connected clients so they take effect immediately.
    await this.broadcastAntiCheatIfPresent(configurationRequest as unknown as Record<string, unknown>);
  }

  private async broadcastAntiCheatIfPresent(
    configuration: Record<string, unknown>,
  ): Promise<void> {
    const raw = configuration[ANTI_CHEAT_CONFIG_KEY];
    if (typeof raw !== "string" || raw.length === 0) {
      return;
    }

    try {
      const rulesBinary = Base64Utils.base64UrlToArrayBuffer(raw);
      const hub = getHubStub();
      await hub.pushAntiCheatConfig(rulesBinary);
      console.log("Broadcast anti-cheat config to all connected clients");
    } catch (error) {
      console.error("Failed to broadcast anti-cheat config:", error);
    }
  }

  public async getBlob(userId: string): Promise<ArrayBuffer> {
    const configuration = await this.gameConfigurationService.get(
      CLOUD_CONFIGURATION_KEY,
    );

    if (configuration === null) {
      throw new ServerError(
        "CONFIGURATION_NOT_FOUND",
        "Configuration not found",
        404,
      );
    }

    const data = JSON.stringify(configuration);
    const encoded = new TextEncoder().encode(data);
    const rawData = encoded.slice().buffer;
    const encryptedData = await this.cryptoService.encryptForUser(
      userId,
      rawData,
    );

    return encryptedData;
  }
}
