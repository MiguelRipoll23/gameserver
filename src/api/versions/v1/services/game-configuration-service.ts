import { injectable } from "@needle-di/core";
import { getKvBinding } from "../../../../core/utils/environment.ts";

/**
 * Stores game configuration request key/value pairs in Workers KV.
 *
 * KV caches reads at the edge for fast lookups. Note that it is eventually
 * consistent: a management write can take up to ~60 seconds to propagate
 * globally, which is the accepted trade-off for read-heavy configuration.
 */
@injectable()
export class GameConfigurationService {
  public async get(key: string): Promise<Record<string, unknown> | null> {
    const raw = await getKvBinding<KVNamespace>("GAME_CONFIGURATION_V1_KV").get(
      key,
    );
    if (raw === null) return null;

    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  public async save(
    key: string,
    value: Record<string, unknown>,
  ): Promise<void> {
    await getKvBinding<KVNamespace>("GAME_CONFIGURATION_V1_KV").put(
      key,
      JSON.stringify(value),
    );
  }
}
