import { injectable } from "@needle-di/core";
import { getKvBinding } from "../../../../core/utils/environment.ts";

/**
 * KV garbage-collection TTL for challenge entries. This is purely a safety
 * net: the application enforces the real 60-second lifetime via the stored
 * `createdAt` timestamp (see OPTIONS_EXPIRATION_TIME). Workers KV deletes
 * expired keys automatically, so no cleanup cron is required.
 *
 * Note: Workers KV `expirationTtl` has a 60-second minimum.
 */
const CHALLENGE_KV_TTL_SECONDS = 5 * 60;

function challengeKey(transactionId: string, type: string): string {
  return `challenge:${type}:${transactionId}`;
}

@injectable()
export class AuthenticationChallengesService {
  public async save(
    transactionId: string,
    type: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const value = JSON.stringify({
      data,
      createdAt: new Date().toISOString(),
    });

    await getKvBinding<KVNamespace>(
      "AUTHENTICATION_CHALLENGES_V1_KV",
      "AUTHENTICATION_CHALLENGES_V1_KV_STAGING",
      "AUTHENTICATION_CHALLENGES_V1_KV_PRODUCTION",
    ).put(
      challengeKey(transactionId, type),
      value,
      { expirationTtl: CHALLENGE_KV_TTL_SECONDS },
    );
  }

  public async consume<T>(
    transactionId: string,
    type: string,
  ): Promise<{ data: T; createdAt: Date } | null> {
    const key = challengeKey(transactionId, type);
    const raw = await getKvBinding<KVNamespace>(
      "AUTHENTICATION_CHALLENGES_V1_KV",
      "AUTHENTICATION_CHALLENGES_V1_KV_STAGING",
      "AUTHENTICATION_CHALLENGES_V1_KV_PRODUCTION",
    ).get(key);
    if (raw === null) return null;

    // KV has no atomic get-and-delete. The delete immediately follows the read,
    // which preserves single-use semantics in practice for the unique random
    // transaction IDs used by WebAuthn ceremonies. (Postgres previously did
    // this atomically with DELETE ... RETURNING.)
    await getKvBinding<KVNamespace>(
      "AUTHENTICATION_CHALLENGES_V1_KV",
      "AUTHENTICATION_CHALLENGES_V1_KV_STAGING",
      "AUTHENTICATION_CHALLENGES_V1_KV_PRODUCTION",
    ).delete(key);

    try {
      const parsed = JSON.parse(raw) as { data: T; createdAt: string };
      return { data: parsed.data, createdAt: new Date(parsed.createdAt) };
    } catch {
      return null;
    }
  }
}
