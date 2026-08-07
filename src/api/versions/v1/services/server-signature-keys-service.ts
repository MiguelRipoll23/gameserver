import { injectable } from "@needle-di/core";
import { getKvBinding } from "../../../../core/utils/environment.ts";
import { SignatureKeysData } from "../types/signature-keys-data-type.ts";

const SERVER_SIGNATURE_KEYS_KEY = "server-signature-keys";

@injectable()
export class ServerSignatureKeysService {
  public async get(): Promise<SignatureKeysData | null> {
    const raw = await getKvBinding<KVNamespace>(
      "SERVER_SIGNATURE_KEYS_V1_KV",
      "SERVER_SIGNATURE_KEYS_V1_KV_STAGING",
      "SERVER_SIGNATURE_KEYS_V1_KV_PRODUCTION",
    ).get(SERVER_SIGNATURE_KEYS_KEY);
    if (raw === null) return null;

    try {
      const parsed = JSON.parse(raw) as SignatureKeysData;
      return {
        privateKey: parsed.privateKey,
        publicKey: parsed.publicKey,
      };
    } catch {
      return null;
    }
  }

  public async save(data: SignatureKeysData): Promise<void> {
    await getKvBinding<KVNamespace>(
      "SERVER_SIGNATURE_KEYS_V1_KV",
      "SERVER_SIGNATURE_KEYS_V1_KV_STAGING",
      "SERVER_SIGNATURE_KEYS_V1_KV_PRODUCTION",
    ).put(
      SERVER_SIGNATURE_KEYS_KEY,
      JSON.stringify(data),
    );
  }
}
