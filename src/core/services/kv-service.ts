import {
  KV_AUTHENTICATION_OPTIONS,
  KV_CONFIGURATION,
  KV_CREDENTIALS,
  KV_KEYS,
  KV_MATCHES,
  KV_MESSAGE,
  KV_REGISTRATION_OPTIONS,
  KV_SCORES,
  KV_SESSIONS,
  KV_USERS,
  KV_USERS_BY_DISPLAY_NAME,
  KV_VERSION,
} from "../../api/versions/v1/constants/kv-constants.ts";
import { VersionKV } from "../../api/versions/v1/interfaces/kv/version-kv.ts";
import { injectable } from "@needle-di/core";
import { RegistrationOptionsKV } from "../../api/versions/v1/interfaces/kv/registration-options-kv.ts";
import { AuthenticationOptionsKV } from "../../api/versions/v1/interfaces/authentication-options.ts";
import { UserKV } from "../../api/versions/v1/interfaces/kv/user-kv.ts";
import { CredentialKV } from "../../api/versions/v1/interfaces/kv/credential-kv.ts";
import { SessionKV } from "../../api/versions/v1/interfaces/kv/session-kv.ts";
import { MessageKV } from "../../api/versions/v1/interfaces/kv/message-kv.ts";
import { MatchKV } from "../../api/versions/v1/interfaces/kv/match_kv.ts";
import { ScoreKV } from "../../api/versions/v1/interfaces/kv/score.ts";
import { ConfigurationType } from "../types/configuration-type.ts";

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

  public async getCredential(
    credentialId: string
  ): Promise<CredentialKV | null> {
    const entry: Deno.KvEntryMaybe<CredentialKV> =
      await this.getKv().get<CredentialKV>([KV_CREDENTIALS, credentialId]);

    return entry.value;
  }

  public async setCredential(
    credentialId: string,
    credential: CredentialKV
  ): Promise<void> {
    await this.getKv().set([KV_CREDENTIALS, credentialId], credential);
  }

  public async getUser(id: string): Promise<UserKV | null> {
    const entry: Deno.KvEntryMaybe<UserKV> = await this.getKv().get<UserKV>([
      KV_USERS,
      id,
    ]);

    return entry.value;
  }

  public async getUserByDisplayName(
    displayName: string
  ): Promise<UserKV | null> {
    const entry: Deno.KvEntryMaybe<UserKV> = await this.getKv().get<UserKV>([
      KV_USERS_BY_DISPLAY_NAME,
      displayName,
    ]);

    return entry.value;
  }

  public async setCredentialAndUser(
    credential: CredentialKV,
    user: UserKV
  ): Promise<Deno.KvCommitResult | Deno.KvCommitError> {
    const displayNameKey = [KV_USERS_BY_DISPLAY_NAME, user.displayName];

    return await this.getKv()
      .atomic()
      .check({ key: displayNameKey, versionstamp: null })
      .set([KV_CREDENTIALS, credential.id], credential)
      .set([KV_USERS, user.userId], user)
      .set(displayNameKey, user)
      .commit();
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

  public async getSession(token: string): Promise<SessionKV | null> {
    const entry: Deno.KvEntryMaybe<SessionKV> =
      await this.getKv().get<SessionKV>([KV_SESSIONS, token]);

    return entry.value;
  }

  public async setSession(userId: string, session: SessionKV): Promise<void> {
    await this.getKv().set([KV_SESSIONS, userId], session, {
      expireIn: 60 * 60 * 1_000,
    });
  }

  public listMessages(): Deno.KvListIterator<MessageKV> {
    return this.getKv().list<MessageKV>({
      prefix: [KV_MESSAGE],
    });
  }

  public async setMessage(message: MessageKV): Promise<void> {
    await this.getKv().set([KV_MESSAGE, message.timestamp], message);
  }

  public async deleteMessage(timestamp: number): Promise<void> {
    await this.getKv().delete([KV_MESSAGE, timestamp]);
  }

  public listMatches(): Deno.KvListIterator<MatchKV> {
    return this.getKv().list<MatchKV>({
      prefix: [KV_MATCHES],
    });
  }

  public async getMatch(userId: string): Promise<MatchKV | null> {
    const entry: Deno.KvEntryMaybe<MatchKV> = await this.getKv().get<MatchKV>([
      KV_MATCHES,
      userId,
    ]);

    return entry.value;
  }

  public async setMatch(
    userId: string,
    match: MatchKV
  ): Promise<Deno.KvCommitResult | Deno.KvCommitError> {
    return await this.getKv()
      .atomic()
      .set([KV_MATCHES, userId], match, {
        expireIn: 60 * 60 * 1_000,
      })
      .commit();
  }

  public async deleteMatch(
    userId: string
  ): Promise<Deno.KvCommitResult | Deno.KvCommitError> {
    return await this.getKv().atomic().delete([KV_MATCHES, userId]).commit();
  }

  public listScores(): Deno.KvListIterator<ScoreKV> {
    return this.getKv().list<ScoreKV>({
      prefix: [KV_SCORES],
    });
  }

  public async getScore(playerId: string): Promise<ScoreKV | null> {
    const entry: Deno.KvEntryMaybe<ScoreKV> = await this.getKv().get<ScoreKV>([
      KV_SCORES,
      playerId,
    ]);

    return entry.value;
  }

  public async setScore(playerId: string, scoreKV: ScoreKV): Promise<void> {
    await this.getKv().set([KV_SCORES, playerId], scoreKV);
  }

  public async deleteUserTemporaryData(
    userId: string
  ): Promise<Deno.KvCommitResult | Deno.KvCommitError> {
    return await this.getKv()
      .atomic()
      .delete([KV_SESSIONS, userId])
      .delete([KV_KEYS, userId])
      .delete([KV_MATCHES, userId])
      .commit();
  }

  private getKv(): Deno.Kv {
    if (this.kv === null) {
      throw new Error("KV not initialized");
    }

    return this.kv;
  }
}
