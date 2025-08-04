import { encodeBase64 } from "hono/utils/encode";
import { KVService } from "../../../../core/services/kv-service.ts";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { create } from "@wok/djwt";
import { Base64Utils } from "../../../../core/utils/base64-utils.ts";
import { inject, injectable } from "@needle-di/core";
import { JWTService } from "../../../../core/services/jwt-service.ts";
import { ConnInfo } from "hono/conninfo";
import { WebAuthnUtils } from "../../../../core/utils/webauthn-utils.ts";
import {
  AuthenticationResponseJSON,
  generateAuthenticationOptions,
  PublicKeyCredentialRequestOptionsJSON,
  VerifiedAuthenticationResponse,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { AuthenticatorTransportFuture } from "@simplewebauthn/types";
import { ServerError } from "../models/server-error.ts";
import { ICEService } from "./ice-service.ts";
import {
  AuthenticationResponse,
  GetAuthenticationOptionsRequest,
  VerifyAuthenticationRequest,
} from "../schemas/authentication-schemas.ts";
import { KV_OPTIONS_EXPIRATION_TIME } from "../constants/kv-constants.ts";
import { usersTable, userCredentialsTable } from "../../../../db/schema.ts";
import { eq } from "drizzle-orm";
import { UserCredentialEntity } from "../../../../db/tables/user-credentials-table.ts";
import { UserEntity } from "../../../../db/tables/users-table.ts";
import { userBansTable } from "../../../../db/tables/user-bans-table.ts";
import { desc } from "drizzle-orm";

@injectable()
export class AuthenticationService {
  constructor(
    private kvService = inject(KVService),
    private databaseService = inject(DatabaseService),
    private jwtService = inject(JWTService),
    private iceService = inject(ICEService)
  ) {}

  public async getOptions(
    authenticationRequest: GetAuthenticationOptionsRequest
  ): Promise<object> {
    const { transactionId } = authenticationRequest;
    const options = await generateAuthenticationOptions({
      rpID: WebAuthnUtils.getRelyingPartyID(),
      userVerification: "preferred",
    });

    await this.kvService.setAuthenticationOptions(transactionId, {
      data: options,
      createdAt: Date.now(),
    });

    return options;
  }

  public async verifyResponse(
    connectionInfo: ConnInfo,
    authenticationRequest: VerifyAuthenticationRequest
  ): Promise<AuthenticationResponse> {
    const { transactionId } = authenticationRequest;
    const authenticationResponse =
      authenticationRequest.authenticationResponse as object as AuthenticationResponseJSON;

    const authenticationOptions = await this.getAuthenticationOptionsOrThrow(
      transactionId
    );

    await this.kvService.deleteAuthenticationOptionsByTransactionId(
      transactionId
    );

    const credentialDB = await this.getCredentialOrThrow(
      authenticationResponse.id
    );

    const verification = await this.verifyAuthenticationResponse(
      authenticationResponse,
      authenticationOptions,
      credentialDB
    );

    await this.updateCredentialCounter(credentialDB, verification);

    const userKV = await this.getUserOrThrowError(credentialDB);

    return await this.getResponseForUser(connectionInfo, userKV);
  }

  public async getResponseForUser(
    connectionInfo: ConnInfo,
    user: UserEntity
  ): Promise<AuthenticationResponse> {
    this.ensureUserNotBanned(user);
    const key = await this.jwtService.getKey();
    const publicIp = connectionInfo.remote.address ?? null;
    const userId = user.id;
    const displayName = user.displayName;

    // Create JWT for client authentication
    const authenticationToken = await create(
      { alg: "HS512", typ: "JWT" },
      { id: userId, name: displayName },
      key
    );

    // Add session key for encryption/decryption
    const sessionKey: string = encodeBase64(
      crypto.getRandomValues(new Uint8Array(32)).buffer
    );

    await this.kvService.setKey(userId, sessionKey);

    // ICE servers
    const iceServers = await this.iceService.getServers();

    const response: AuthenticationResponse = {
      userId,
      displayName,
      authenticationToken,
      sessionKey,
      publicIp: publicIp,
      rtcIceServers: iceServers,
    };

    return response;
  }

  private async getAuthenticationOptionsOrThrow(
    transactionId: string
  ): Promise<PublicKeyCredentialRequestOptionsJSON> {
    const authenticationOptions =
      await this.kvService.getAuthenticationOptionsByTransactionId(
        transactionId
      );

    if (authenticationOptions === null) {
      throw new ServerError(
        "AUTHENTICATION_OPTIONS_NOT_FOUND",
        "Authentication options not found",
        400
      );
    }

    // Check if the authentication options are expired
    const createdAt = authenticationOptions.createdAt;

    if (createdAt + KV_OPTIONS_EXPIRATION_TIME < Date.now()) {
      throw new ServerError(
        "AUTHENTICATION_OPTIONS_EXPIRED",
        "Authentication options expired",
        400
      );
    }

    return authenticationOptions.data;
  }

  private async getCredentialOrThrow(
    id: string
  ): Promise<UserCredentialEntity> {
    const db = this.databaseService.get();
    const credentials = await db
      .select()
      .from(userCredentialsTable)
      .where(eq(userCredentialsTable.id, id))
      .limit(1);

    if (credentials.length === 0) {
      throw new ServerError(
        "CREDENTIAL_NOT_FOUND",
        "Credential not found",
        400
      );
    }

    return credentials[0];
  }

  private transformCredentialForWebAuthn(credential: UserCredentialEntity) {
    // Convert base64 string back to Uint8Array for WebAuthn usage
    const publicKeyBuffer = new Uint8Array(
      Base64Utils.base64UrlToArrayBuffer(credential.publicKey)
    );

    return {
      id: credential.id,
      publicKey: publicKeyBuffer,
      counter: credential.counter,
      transports: credential.transports as
        | AuthenticatorTransportFuture[]
        | undefined,
    };
  }

  private async verifyAuthenticationResponse(
    authenticationResponse: AuthenticationResponseJSON,
    authenticationOptions: PublicKeyCredentialRequestOptionsJSON,
    credentialDB: UserCredentialEntity
  ): Promise<VerifiedAuthenticationResponse> {
    try {
      const verification = await verifyAuthenticationResponse({
        response: authenticationResponse,
        expectedChallenge: authenticationOptions.challenge,
        expectedOrigin: WebAuthnUtils.getRelyingPartyOrigin(),
        expectedRPID: WebAuthnUtils.getRelyingPartyID(),
        credential: this.transformCredentialForWebAuthn(credentialDB),
      });

      if (verification.verified === false) {
        throw new ServerError(
          "AUTHENTICATION_FAILED",
          "Authentication failed",
          400
        );
      }

      return verification;
    } catch (error) {
      console.error(error);
      throw new ServerError(
        "AUTHENTICATION_FAILED",
        "Authentication failed",
        400
      );
    }
  }

  private async updateCredentialCounter(
    credential: UserCredentialEntity,
    verification: VerifiedAuthenticationResponse
  ): Promise<void> {
    const { authenticationInfo } = verification;
    credential.counter = authenticationInfo.newCounter;

    const db = this.databaseService.get();
    try {
      await db
        .update(userCredentialsTable)
        .set({ counter: credential.counter })
        .where(eq(userCredentialsTable.id, credential.id));
    } catch (error) {
      console.error("Failed to update credential counter:", error);
      throw new ServerError(
        "CREDENTIAL_COUNTER_UPDATE_FAILED",
        "Failed to update credential counter",
        500
      );
    }
  }

  private async getUserOrThrowError(
    credentialDB: UserCredentialEntity
  ): Promise<UserEntity> {
    const userId = credentialDB.userId;
    const db = this.databaseService.get();
    const users = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (users.length === 0) {
      throw new ServerError("USER_NOT_FOUND", "User not found", 400);
    }

    const user = users[0];

    return user;
  }

  private async ensureUserNotBanned(user: UserEntity): Promise<void> {
    const db = this.databaseService.get();
    const userBans = await db
      .select({ expiresAt: userBansTable.expiresAt })
      .from(userBansTable)
      .where(eq(userBansTable.userId, user.id))
      .orderBy(desc(userBansTable.createdAt))
      .limit(1);

    if (userBans.length > 0) {
      const latestBan = userBans[0];
      const now = new Date();

      // Check if it's a permanent ban (no expiration date)
      if (!latestBan.expiresAt) {
        throw new ServerError(
          "USER_BANNED_PERMANENTLY",
          "Your account has been permanently banned",
          403
        );
      }

      // Check if temporary ban is still active
      if (latestBan.expiresAt > now) {
        const remainingTime = Math.ceil(
          (latestBan.expiresAt.getTime() - now.getTime()) / (1000 * 60)
        );
        throw new ServerError(
          "USER_BANNED_TEMPORARILY",
          `Your account is temporarily banned. The ban will expire in ${remainingTime} minutes`,
          403
        );
      }
    }
  }
}
