import { inject, injectable } from "@needle-di/core";
import { ServerError } from "../models/server-error.ts";
import { CryptoService } from "./crypto-service.ts";
import {
  GetConfigurationResponse,
  UpdateConfigurationRequest,
} from "../schemas/configuration-schemas.ts";
import { GameConfigurationService } from "./game-configuration-service.ts";
import { AntiCheatRulesService } from "./anti-cheat-rules-service.ts";
import type { AntiCheatRule } from "../types/anti-cheat-rule-type.ts";
import { getHubStub } from "../../../../core/utils/environment.ts";
import { Base64Utils } from "../../../../core/utils/base64-utils.ts";

const CLOUD_CONFIGURATION_KEY = "cloud_configuration";
const ANTI_CHEAT_CONFIG_KEY = "4030BF2F";

@injectable()
export class ConfigurationService {
  constructor(
    private gameConfigurationService = inject(GameConfigurationService),
    private cryptoService = inject(CryptoService),
    private antiCheatRulesService = inject(AntiCheatRulesService),
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
    const configuration = {
      ...configurationRequest,
    } as Record<string, unknown>;

    // Preserve the existing anti-cheat blob when the caller did not provide
    // one, so a configuration update never silently drops the rules the game
    // client is already using.
    if (typeof configuration[ANTI_CHEAT_CONFIG_KEY] !== "string") {
      const current = await this.gameConfigurationService.get(
        CLOUD_CONFIGURATION_KEY,
      );
      if (current && typeof current[ANTI_CHEAT_CONFIG_KEY] === "string") {
        configuration[ANTI_CHEAT_CONFIG_KEY] =
          current[ANTI_CHEAT_CONFIG_KEY];
      }
    }

    await this.gameConfigurationService.save(
      CLOUD_CONFIGURATION_KEY,
      configuration,
    );

    // If the configuration contains anti-cheat rules, push them to all
    // connected clients so they take effect immediately.
    await this.broadcastAntiCheatIfPresent(configuration);
  }

  /**
   * Persists a new anti-cheat rule set and makes it live:
   * saves the serialized blob into the `4030BF2F` game configuration key and
   * pushes it to every connected client.
   */
  public async updateAntiCheatRules(
    rules: readonly AntiCheatRule[],
  ): Promise<void> {
    const configuration =
      (await this.gameConfigurationService.get(CLOUD_CONFIGURATION_KEY)) ?? {};

    configuration[ANTI_CHEAT_CONFIG_KEY] =
      this.antiCheatRulesService.serializeRulesToBase64Url(rules);

    await this.gameConfigurationService.save(
      CLOUD_CONFIGURATION_KEY,
      configuration,
    );

    await this.broadcastAntiCheatIfPresent(configuration);
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
}
