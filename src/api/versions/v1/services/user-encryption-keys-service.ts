import { injectable } from "@needle-di/core";
import { env } from "cloudflare:workers";

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
    return await env.GAMESERVER_KV.get(userEncryptionKeyKey(userId));
  }

  public async save(userId: string, key: string): Promise<void> {
    await env.GAMESERVER_KV.put(userEncryptionKeyKey(userId), key, {
      expirationTtl: 30 * 24 * 60 * 60,
    });
  }

  public async delete(userId: string): Promise<void> {
    await env.GAMESERVER_KV.delete(userEncryptionKeyKey(userId));
  }
}
