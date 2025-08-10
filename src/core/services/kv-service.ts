import {
  KV_AUTHENTICATION_OPTIONS,
  KV_CONFIGURATION,
  KV_KEYS,
  KV_REGISTRATION_OPTIONS,
  KV_VERSION,
} from "../../api/versions/v1/constants/kv-constants.ts";
import { VersionKV } from "../../api/versions/v1/interfaces/kv/version-kv.ts";
import { injectable } from "@needle-di/core";
import { RegistrationOptionsKV } from "../../api/versions/v1/interfaces/kv/registration-options-kv.ts";
import { AuthenticationOptionsKV } from "../../api/versions/v1/interfaces/kv/authentication-options-kv.ts";
import { ConfigurationType } from "../../api/versions/v1/types/configuration-type.ts";

@injectable()
export class KVService {
  private kv: Deno.Kv | null = null;

  public async init(): Promise<void> {
    this.kv = await Deno.openKv();
    console.log("KV connection opened");
  }

  public async getVersion(): Promise<VersionKV | null> {
    const entry: Deno.KvEntryMaybe<VersionKV> =
      await this.getKv().get<VersionKV>([KV_VERSION]);

    return entry.value;
  }

  public async setVersion(version: VersionKV): Promise<void> {
    await this.getKv().set([KV_VERSION], version);
  }

  public async getRegistrationOptionsByTransactionId(
    transactionId: string
  ): Promise<RegistrationOptionsKV | null> {
    const entry: Deno.KvEntryMaybe<RegistrationOptionsKV> =
      await this.getKv().get<RegistrationOptionsKV>([
        KV_REGISTRATION_OPTIONS,
        transactionId,
      ]);

    return entry.value;
  }

  public async setRegistrationOptions(
    transactionId: string,
    registrationOptions: RegistrationOptionsKV
  ): Promise<void> {
    await this.getKv().set(
      [KV_REGISTRATION_OPTIONS, transactionId],
      registrationOptions,
      {
        expireIn: 60 * 1_000,
      }
    );
  }

  public async deleteRegistrationOptionsByTransactionId(
    transactionId: string
  ): Promise<void> {
    await this.getKv().delete([KV_REGISTRATION_OPTIONS, transactionId]);
  }

  public async getAuthenticationOptionsByTransactionId(
    transactionId: string
  ): Promise<AuthenticationOptionsKV | null> {
    const entry: Deno.KvEntryMaybe<AuthenticationOptionsKV> =
      await this.getKv().get<AuthenticationOptionsKV>([
        KV_AUTHENTICATION_OPTIONS,
        transactionId,
      ]);

    return entry.value;
  }

  public async setAuthenticationOptions(
    requestId: string,
    authenticationOptions: AuthenticationOptionsKV
  ): Promise<void> {
    await this.getKv().set(
      [KV_AUTHENTICATION_OPTIONS, requestId],
      authenticationOptions,
      {
        expireIn: 60 * 1_000,
      }
    );
  }

  public async deleteAuthenticationOptionsByTransactionId(
    transactionId: string
  ): Promise<void> {
    await this.getKv().delete([KV_AUTHENTICATION_OPTIONS, transactionId]);
  }

  public async getConfiguration(): Promise<ConfigurationType | null> {
    const entry: Deno.KvEntryMaybe<ConfigurationType> =
      await this.getKv().get<ConfigurationType>([KV_CONFIGURATION]);

    return entry.value;
  }

  public async setConfiguration(
    configuration: ConfigurationType
  ): Promise<void> {
    await this.getKv().set([KV_CONFIGURATION], configuration);
  }

  public async getKey(userId: string): Promise<string | null> {
    const entry: Deno.KvEntryMaybe<string> = await this.getKv().get<string>([
      KV_KEYS,
      userId,
    ]);

    return entry.value;
  }

  public async setKey(userId: string, key: string): Promise<void> {
    await this.getKv().set([KV_KEYS, userId], key, {
      expireIn: 60 * 60 * 1_000,
    });
  }

  public async deleteUserTemporaryData(
    userId: string
  ): Promise<Deno.KvCommitResult | Deno.KvCommitError> {
    return await this.getKv().atomic().delete([KV_KEYS, userId]).commit();
  }

  private getKv(): Deno.Kv {
    if (this.kv === null) {
      throw new Error("KV not initialized");
    }

    return this.kv;
  }
}
