import { injectable } from "@needle-di/core";
import { getKvBinding } from "../../../../core/utils/environment.ts";
import { KV_GAMESERVER } from "../constants/environment-constants.ts";

function userEncryptionKeyKey(userId: string): string {
  return `user-encryption-keys:${userId}`;
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
      KV_GAMESERVER,
    ).get(userEncryptionKeyKey(userId));
  }

  public async save(userId: string, key: string): Promise<void> {
    await getKvBinding<KVNamespace>(KV_GAMESERVER).put(
      userEncryptionKeyKey(userId),
      key,
      { expirationTtl: 30 * 24 * 60 * 60 },
    );
  }

  public async delete(userId: string): Promise<void> {
    await getKvBinding<KVNamespace>(
      KV_GAMESERVER,
    ).delete(userEncryptionKeyKey(userId));
  }
}
