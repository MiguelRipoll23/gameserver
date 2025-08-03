import { encodeBase64 } from "hono/utils/encode";
import { UserKV } from "../interfaces/kv/user-kv.ts";
import { KVService } from "../../../../core/services/kv-service.ts";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { create } from "@wok/djwt";
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
import {
  AuthenticatorTransportFuture,
  CredentialDeviceType,
} from "@simplewebauthn/types";
import { CredentialKV } from "../interfaces/kv/credential-kv.ts";
import { ServerError } from "../models/server-error.ts";
import { ICEService } from "./ice-service.ts";
import {
  AuthenticationResponse,
  GetAuthenticationOptionsRequest,
  VerifyAuthenticationRequest,
} from "../schemas/authentication-schemas.ts";
import { KV_OPTIONS_EXPIRATION_TIME } from "../constants/kv-constants.ts";
import { BAN_MESSAGE_TEMPLATE } from "../constants/api-constants.ts";
import { usersTable, userCredentialsTable } from "../../../../db/schema.ts";
import { eq } from "drizzle-orm";

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

    const credentialKV = await this.getCredentialOrThrow(
      authenticationResponse.id
    );

    const verification = await this.verifyAuthenticationResponse(
      authenticationResponse,
      authenticationOptions,
      credentialKV
    );

    await this.updateCredentialCounter(credentialKV, verification);

    const userKV = await this.getUserOrThrowError(credentialKV);

    return await this.getResponseForUser(connectionInfo, userKV);
  }

  public async getResponseForUser(
    connectionInfo: ConnInfo,
    user: UserKV
  ): Promise<AuthenticationResponse> {
    this.ensureUserNotBanned(user);
    const key = await this.jwtService.getKey();
    const publicIp = connectionInfo.remote.address ?? null;
    const userId = user.userId;
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

  private async getCredentialOrThrow(id: string): Promise<CredentialKV> {
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

    const credential = credentials[0];
    // Convert base64 string back to Uint8Array
    const publicKeyBuffer = new Uint8Array(
      atob(credential.publicKey)
        .split("")
        .map((char) => char.charCodeAt(0))
    );

    return {
      id: credential.id,
      userId: credential.userId,
      publicKey: publicKeyBuffer,
      counter: credential.counter,
      deviceType: credential.deviceType as CredentialDeviceType,
      backupStatus: credential.backupStatus,
      transports: credential.transports as
        | AuthenticatorTransportFuture[]
        | undefined,
    };
  }

  private async verifyAuthenticationResponse(
    authenticationResponse: AuthenticationResponseJSON,
    authenticationOptions: PublicKeyCredentialRequestOptionsJSON,
    credentialKV: CredentialKV
  ): Promise<VerifiedAuthenticationResponse> {
    try {
      const verification = await verifyAuthenticationResponse({
        response: authenticationResponse,
        expectedChallenge: authenticationOptions.challenge,
        expectedOrigin: WebAuthnUtils.getRelyingPartyOrigin(),
        expectedRPID: WebAuthnUtils.getRelyingPartyID(),
        credential: {
          id: credentialKV.id,
          publicKey: credentialKV.publicKey,
          counter: credentialKV.counter,
          transports: credentialKV.transports,
        },
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
    credential: CredentialKV,
    verification: VerifiedAuthenticationResponse
  ): Promise<void> {
    const { authenticationInfo } = verification;
    credential.counter = authenticationInfo.newCounter;

    const db = this.databaseService.get();
    await db
      .update(userCredentialsTable)
      .set({ counter: credential.counter })
      .where(eq(userCredentialsTable.id, credential.id));
  }

  private async getUserOrThrowError(
    credentialKV: CredentialKV
  ): Promise<UserKV> {
    const userId = credentialKV.userId;
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
    return {
      userId: user.id,
      displayName: user.displayName,
      createdAt: user.createdAt.getTime(),
      // Note: ban information is not stored in PostgreSQL table yet
      // This would need to be added to the usersTable schema if needed
    };
  }

  private ensureUserNotBanned(user: UserKV): void {
    if (user.ban) {
      const { expiresAt, reason } = user.ban;

      if (expiresAt !== null && expiresAt < Date.now()) {
        user.ban = undefined;
        // Update user in database - for now we skip this as ban info is not in PostgreSQL schema
        // TODO: Add ban information to users table schema and update here
      } else {
        const banType = expiresAt === null ? "permanently" : "temporarily";
        const message = BAN_MESSAGE_TEMPLATE.replace("{type}", banType).replace(
          "{reason}",
          reason.toLowerCase()
        );
        throw new ServerError("USER_BANNED", message, 403);
      }
    }
  }
}
