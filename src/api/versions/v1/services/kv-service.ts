import { inject, injectable } from "@needle-di/core";
import { BaseKVService } from "../../../../core/services/kv-service.ts";
import {
  KV_AUTHENTICATION_OPTIONS,
  KV_BANNED_USERS,
  KV_CONFIGURATION,
  KV_OPTIONS_EXPIRATION_TIME,
  KV_REFRESH_TOKENS,
  KV_REGISTRATION_OPTIONS,
  KV_SIGNATURE_KEYS,
  KV_USER_KEYS,
  KV_USER_KEYS_EXPIRATION_TIME,
  KV_VERSION,
} from "../constants/kv-constants.ts";
import { AuthenticationOptionsKV } from "../interfaces/kv/authentication-options-kv.ts";
import { RegistrationOptionsKV } from "../interfaces/kv/registration-options-kv.ts";
import { VersionKV } from "../interfaces/kv/version-kv.ts";
import { ConfigurationType } from "../types/configuration-type.ts";
import { SignatureKeysKV } from "../interfaces/kv/signature-keys-kv.ts";
import { RefreshTokenKV } from "../interfaces/kv/refresh-token-kv.ts";

@injectable()
export class KVService {
  constructor(private kvService = inject(BaseKVService)) {}

  public async getSignatureKeys(): Promise<SignatureKeysKV | null> {
    const entry: Deno.KvEntryMaybe<SignatureKeysKV> =
      await this.getKv().get<SignatureKeysKV>([KV_SIGNATURE_KEYS]);

    return entry.value;
  }

  public async setSignatureKeys(signatureKeys: SignatureKeysKV): Promise<void> {
    await this.getKv().set([KV_SIGNATURE_KEYS], signatureKeys);
  }

  public async getVersion(): Promise<VersionKV | null> {
    const entry: Deno.KvEntryMaybe<VersionKV> =
      await this.getKv().get<VersionKV>([KV_VERSION]);

    return entry.value;
  }

  public async setVersion(version: VersionKV): Promise<void> {
    await this.getKv().set([KV_VERSION], version);
  }

  public async consumeRegistrationOptionsByTransactionId(
    transactionId: string,
  ): Promise<RegistrationOptionsKV | null> {
    const key = [KV_REGISTRATION_OPTIONS, transactionId];
    const kv = this.getKv();
    const entry: Deno.KvEntryMaybe<RegistrationOptionsKV> =
      await kv.get<RegistrationOptionsKV>(key);

    if (entry.value === null) {
      return null;
    }

    const commit = await kv.atomic().check(entry).delete(key).commit();

    if (!commit.ok) {
      return null;
    }

    return entry.value;
  }

  public async setRegistrationOptions(
    transactionId: string,
    registrationOptions: RegistrationOptionsKV,
  ): Promise<void> {
    await this.getKv().set(
      [KV_REGISTRATION_OPTIONS, transactionId],
      registrationOptions,
      {
        expireIn: KV_OPTIONS_EXPIRATION_TIME,
      },
    );
  }

  public async takeAuthenticationOptionsByTransactionId(
    transactionId: string,
  ): Promise<AuthenticationOptionsKV | null> {
    const key = [KV_AUTHENTICATION_OPTIONS, transactionId];
    const kv = this.getKv();
    const entry: Deno.KvEntryMaybe<AuthenticationOptionsKV> =
      await kv.get<AuthenticationOptionsKV>(key);

    if (entry.value === null) {
      return null;
    }

    const result = await kv.atomic().check(entry).delete(key).commit();

    if (!result.ok) {
      return null;
    }

    return entry.value;
  }

  public async setAuthenticationOptions(
    requestId: string,
    authenticationOptions: AuthenticationOptionsKV,
  ): Promise<void> {
    await this.getKv().set(
      [KV_AUTHENTICATION_OPTIONS, requestId],
      authenticationOptions,
      {
        expireIn: KV_OPTIONS_EXPIRATION_TIME,
      },
    );
  }

  public async getConfiguration(): Promise<ConfigurationType | null> {
    const entry: Deno.KvEntryMaybe<ConfigurationType> =
      await this.getKv().get<ConfigurationType>([KV_CONFIGURATION]);

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
      expireIn: KV_USER_KEYS_EXPIRATION_TIME,
    });
  }

  public async deleteUserTemporaryData(
    userId: string,
  ): Promise<Deno.KvCommitResult | Deno.KvCommitError> {
    return await this.getKv().atomic().delete([KV_USER_KEYS, userId]).commit();
  }

  public async banUser(userId: string, expiresAt?: Date | null): Promise<void> {
    let options: { expireIn?: number } | undefined;

    if (expiresAt) {
      const ttl = expiresAt.getTime() - Date.now();

      if (ttl > 0) {
        options = { expireIn: ttl };
      }
    }

    await this.getKv().set([KV_BANNED_USERS, userId], true, options);
  }

  public async unbanUser(userId: string): Promise<void> {
    await this.getKv().delete([KV_BANNED_USERS, userId]);
  }

  public async isUserBanned(userId: string): Promise<boolean> {
    const entry: Deno.KvEntryMaybe<boolean> = await this.getKv().get<boolean>([
      KV_BANNED_USERS,
      userId,
    ]);
    return entry.value === true;
  }

  public async setRefreshToken(
    tokenHash: string,
    refreshToken: RefreshTokenKV,
  ): Promise<void> {
    const ttl = Math.max(0, refreshToken.expiresAt - Date.now());

    await this.getKv().set([KV_REFRESH_TOKENS, tokenHash], refreshToken, {
      expireIn: ttl,
    });
  }

  public async consumeRefreshToken(
    tokenHash: string,
  ): Promise<RefreshTokenKV | null> {
    const key = [KV_REFRESH_TOKENS, tokenHash];
    const kv = this.getKv();
    const entry = await kv.get<RefreshTokenKV>(key);

    if (entry.value === null) {
      return null;
    }

    const result = await kv.atomic().check(entry).delete(key).commit();

    if (!result.ok) {
      return null;
    }

    return entry.value;
  }

  private getKv(): Deno.Kv {
    return this.kvService.getKv();
  }
}
