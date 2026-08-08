import { injectable } from "@needle-di/core";
import { getKvBinding } from "../../../../core/utils/environment.ts";

function userEncryptionKeyKey(userId: string): string {
  return `user:${userId}`;
}

/**
 * Stores per-user symmetric encryption keys in Workers KV. Keys are written on
 * sign-in and removed when the user's WebSocket connection closes. No TTL is
 * set because an active session's key must outlive the connection.
 */
@injectable()
export class UserEncryptionKeysService {
  public async get(userId: string): Promise<string | null> {
    return await getKvBinding<KVNamespace>(
      "USER_ENCRYPTION_KEYS_V1_KV",
      "USER_ENCRYPTION_KEYS_V1_KV_STAGING",
      "USER_ENCRYPTION_KEYS_V1_KV_PRODUCTION",
    ).get(userEncryptionKeyKey(userId));
  }

  public async save(userId: string, key: string): Promise<void> {
    await getKvBinding<KVNamespace>(
      "USER_ENCRYPTION_KEYS_V1_KV",
      "USER_ENCRYPTION_KEYS_V1_KV_STAGING",
      "USER_ENCRYPTION_KEYS_V1_KV_PRODUCTION",
    ).put(userEncryptionKeyKey(userId), key, { expirationTtl: 30 * 24 * 60 * 60 });
  }

  public async delete(userId: string): Promise<void> {
    await getKvBinding<KVNamespace>(
      "USER_ENCRYPTION_KEYS_V1_KV",
      "USER_ENCRYPTION_KEYS_V1_KV_STAGING",
      "USER_ENCRYPTION_KEYS_V1_KV_PRODUCTION",
    ).delete(userEncryptionKeyKey(userId));
  }
}
