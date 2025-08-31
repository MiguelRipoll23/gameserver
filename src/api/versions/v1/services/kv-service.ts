import { inject, injectable } from "@needle-di/core";
import { BaseKVService } from "../../../../core/services/kv-service.ts";
import {
  KV_CONFIGURATION,
  KV_SIGNATURE_KEYS,
  KV_USER_KEYS,
  KV_VERSION,
} from "../constants/kv-constants.ts";
import { VersionKV } from "../interfaces/kv/version-kv.ts";
import { ConfigurationType } from "../types/configuration-type.ts";
import { SignatureKeysKV } from "../interfaces/kv/signature-keys-kv.ts";

@injectable()
export class KVService {
  constructor(private kvService = inject(BaseKVService)) {}

  public async getSignatureKeys(): Promise<SignatureKeysKV | null> {
    const entry: Deno.KvEntryMaybe<SignatureKeysKV> = await this.getKv().get<
      SignatureKeysKV
    >([KV_SIGNATURE_KEYS]);

    return entry.value;
  }

  public async setSignatureKeys(signatureKeys: SignatureKeysKV): Promise<void> {
    await this.getKv().set([KV_SIGNATURE_KEYS], signatureKeys);
  }

  public async getVersion(): Promise<VersionKV | null> {
    const entry: Deno.KvEntryMaybe<VersionKV> = await this.getKv().get<
      VersionKV
    >([KV_VERSION]);

    return entry.value;
  }

  public async setVersion(version: VersionKV): Promise<void> {
    await this.getKv().set([KV_VERSION], version);
  }

  public async getConfiguration(): Promise<ConfigurationType | null> {
    const entry: Deno.KvEntryMaybe<ConfigurationType> = await this.getKv().get<
      ConfigurationType
    >([KV_CONFIGURATION]);

    return entry.value;
  }

  public async setConfiguration(
    configuration: ConfigurationType,
  ): Promise<void> {
    await this.getKv().set([KV_CONFIGURATION], configuration);
  }

  public async getUserKey(userId: string): Promise<string | null> {
    const entry: Deno.KvEntryMaybe<string> = await this.getKv().get<string>([
      KV_USER_KEYS,
      userId,
    ]);

    return entry.value;
  }

  public async setUserKey(userId: string, key: string): Promise<void> {
    await this.getKv().set([KV_USER_KEYS, userId], key, {
      expireIn: 60 * 60 * 1_000,
    });
  }

  public async deleteUserTemporaryData(
    userId: string,
  ): Promise<Deno.KvCommitResult | Deno.KvCommitError> {
    return await this.getKv().atomic().delete([KV_USER_KEYS, userId]).commit();
  }

  private getKv(): Deno.Kv {
    return this.kvService.getKv();
  }
}
