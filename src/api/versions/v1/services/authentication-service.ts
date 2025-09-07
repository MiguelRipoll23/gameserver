import { encodeBase64 } from "hono/utils/encode";
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
import {
  authenticationOptionsTable,
  rolesTable,
  userBansTable,
  userCredentialsTable,
  userRolesTable,
  usersTable,
} from "../../../../db/schema.ts";
import { and, eq, lt } from "drizzle-orm";
import { UserCredentialEntity } from "../../../../db/tables/user-credentials-table.ts";
import { UserEntity } from "../../../../db/tables/users-table.ts";
import { desc } from "drizzle-orm";
import { KVService } from "./kv-service.ts";
import { SignatureService } from "./signature-service.ts";

@injectable()
export class AuthenticationService {
  constructor(
    private kvService = inject(KVService),
    private databaseService = inject(DatabaseService),
    private jwtService = inject(JWTService),
    private signatureService = inject(SignatureService),
    private iceService = inject(ICEService),
  ) {}

  public async getOptions(
    authenticationRequest: GetAuthenticationOptionsRequest,
  ): Promise<object> {
    const { transactionId } = authenticationRequest;
    const options = await generateAuthenticationOptions({
      rpID: WebAuthnUtils.getRelyingPartyID(),
      userVerification: "preferred",
    });
    await this.databaseService
      .get()
      .insert(authenticationOptionsTable)
      .values({
        transactionId,
        data: options,
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: authenticationOptionsTable.transactionId,
        set: { data: options, createdAt: new Date() },
      });

    return options;
  }

  public async verifyResponse(
    connectionInfo: ConnInfo,
    authenticationRequest: VerifyAuthenticationRequest,
  ): Promise<AuthenticationResponse> {
    const { transactionId } = authenticationRequest;
    const authenticationResponse = authenticationRequest
      .authenticationResponse as unknown as AuthenticationResponseJSON;

    const authenticationOptions = await this.getAuthenticationOptionsOrThrow(
      transactionId,
    );

    const credential = await this.getCredentialOrThrow(
      authenticationResponse.id,
    );

    const verification = await this.verifyAuthenticationResponse(
      authenticationResponse,
      authenticationOptions,
      credential,
    );

    await this.updateCredentialCounter(credential, verification);

    const user = await this.getUserOrThrowError(credential);

    return await this.getResponseForUser(connectionInfo, user);
  }

  public async getResponseForUser(
    connectionInfo: ConnInfo,
    user: UserEntity,
  ): Promise<AuthenticationResponse> {
    await this.ensureUserNotBanned(user);

    const userId = user.id;
    const userDisplayName = user.displayName;
    const userPublicIp = connectionInfo.remote.address ?? null;

    // Fetch user roles
    const userRoles = await this.getUserRoles(userId);

    // Create JWT for client authentication
    const jwtKey = await this.jwtService.getKey();

    const authenticationToken = await create(
      { alg: "HS512", typ: "JWT" },
      { id: userId, name: userDisplayName, roles: userRoles },
      jwtKey,
    );

    // Add user symmetric key for encryption/decryption
    const userSymmetricKey: string = encodeBase64(
      crypto.getRandomValues(new Uint8Array(32)).buffer,
    );

    await this.kvService.setUserKey(userId, userSymmetricKey);

    // Server configuration
    const serverSignaturePublicKey = this.signatureService
      .getEncodedPublicKey();
    const rtcIceServers = await this.iceService.getServers();

    const response: AuthenticationResponse = {
      authenticationToken,
      userId,
      userDisplayName,
      userPublicIp,
      userSymmetricKey,
      serverSignaturePublicKey,
      rtcIceServers,
    };

    return response;
  }

  private async getAuthenticationOptionsOrThrow(
    transactionId: string,
  ): Promise<PublicKeyCredentialRequestOptionsJSON> {
    const consumed = await this.databaseService
      .get()
      .delete(authenticationOptionsTable)
      .where(eq(authenticationOptionsTable.transactionId, transactionId))
      .returning({
        data: authenticationOptionsTable.data,
        createdAt: authenticationOptionsTable.createdAt,
      });

    if (consumed.length === 0) {
      throw new ServerError(
        "AUTHENTICATION_OPTIONS_NOT_FOUND",
        "Authentication options not found",
        400,
      );
    }

    const record = consumed[0];

    if (record.createdAt.getTime() + KV_OPTIONS_EXPIRATION_TIME < Date.now()) {
      throw new ServerError(
        "AUTHENTICATION_OPTIONS_EXPIRED",
        "Authentication options expired",
        400,
      );
    }

    return record.data as PublicKeyCredentialRequestOptionsJSON;
  }

  private async getCredentialOrThrow(
    id: string,
  ): Promise<UserCredentialEntity> {
    let credentials;

    try {
      credentials = await this.databaseService.withRlsCredential(id, (tx) => {
        return tx
          .select()
          .from(userCredentialsTable)
          .where(eq(userCredentialsTable.id, id))
          .limit(1);
      });
    } catch (error) {
      console.error("Failed to query credential:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to retrieve credential",
        500,
      );
    }

    if (credentials.length === 0) {
      throw new ServerError(
        "CREDENTIAL_NOT_FOUND",
        "Credential not found",
        400,
      );
    }

    return credentials[0];
  }

  private transformCredentialForWebAuthn(credential: UserCredentialEntity) {
    // Convert base64 string back to Uint8Array for WebAuthn usage
    const publicKeyBuffer = new Uint8Array(
      Base64Utils.base64UrlToArrayBuffer(credential.publicKey),
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
    credential: UserCredentialEntity,
  ): Promise<VerifiedAuthenticationResponse> {
    try {
      const verification = await verifyAuthenticationResponse({
        response: authenticationResponse,
        expectedChallenge: authenticationOptions.challenge,
        expectedOrigin: WebAuthnUtils.getRelyingPartyOrigin(),
        expectedRPID: WebAuthnUtils.getRelyingPartyID(),
        credential: this.transformCredentialForWebAuthn(credential),
      });

      if (verification.verified === false) {
        throw new ServerError(
          "AUTHENTICATION_FAILED",
          "Authentication failed",
          400,
        );
      }

      return verification;
    } catch (error) {
      console.error(error);
      throw new ServerError(
        "AUTHENTICATION_FAILED",
        "Authentication failed",
        400,
      );
    }
  }

  private async updateCredentialCounter(
    credential: UserCredentialEntity,
    verification: VerifiedAuthenticationResponse,
  ): Promise<void> {
    const { authenticationInfo } = verification;
    const newCounter = authenticationInfo.newCounter;

    try {
      const updated = await this.databaseService.withRlsCredential(
        credential.id,
        (tx) => {
          return tx
            .update(userCredentialsTable)
            .set({ counter: newCounter })
            .where(
              and(
                eq(userCredentialsTable.id, credential.id),
                lt(userCredentialsTable.counter, newCounter),
              ),
            )
            .returning({ id: userCredentialsTable.id });
        },
      );
      if (updated.length === 0) {
        throw new ServerError(
          "CREDENTIAL_COUNTER_UPDATE_FAILED",
          "Failed to update credential counter",
          500,
        );
      }
    } catch (error) {
      console.error("Failed to update credential counter:", error);
      throw new ServerError(
        "CREDENTIAL_COUNTER_UPDATE_FAILED",
        "Failed to update credential counter",
        500,
      );
    }
  }

  private async getUserOrThrowError(
    credential: UserCredentialEntity,
  ): Promise<UserEntity> {
    const userId = credential.userId;
    let users;

    try {
      users = await this.databaseService.withRlsUser(userId, (tx) => {
        return tx
          .select()
          .from(usersTable)
          .where(eq(usersTable.id, userId))
          .limit(1);
      });
    } catch (error) {
      console.error("Failed to query user:", error);
      throw new ServerError("DATABASE_ERROR", "Failed to retrieve user", 500);
    }

    if (users.length === 0) {
      throw new ServerError("USER_NOT_FOUND", "User not found", 400);
    }

    const user = users[0];

    return user;
  }

  private async getUserRoles(userId: string): Promise<string[]> {
    let userRoleResults;

    try {
      userRoleResults = await this.databaseService.withRlsUser(userId, (tx) => {
        return tx
          .select({ name: rolesTable.name })
          .from(userRolesTable)
          .innerJoin(rolesTable, eq(userRolesTable.roleId, rolesTable.id))
          .where(eq(userRolesTable.userId, userId));
      });
    } catch (error) {
      console.error("Failed to query user roles:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to retrieve user roles",
        500,
      );
    }

    return userRoleResults.map((role) => role.name);
  }

  private async ensureUserNotBanned(user: UserEntity): Promise<void> {
    let userBans;

    try {
      userBans = await this.databaseService.withRlsUser(user.id, (tx) => {
        return tx
          .select({ expiresAt: userBansTable.expiresAt })
          .from(userBansTable)
          .where(eq(userBansTable.userId, user.id))
          .orderBy(desc(userBansTable.createdAt))
          .limit(1);
      });
    } catch (error) {
      console.error("Failed to query user bans:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to retrieve user bans",
        500,
      );
    }

    if (userBans.length === 0) {
      return;
    }

    const latestBan = userBans[0];
    const now = new Date();

    // Permanent ban
    if (!latestBan.expiresAt) {
      throw new ServerError(
        "USER_BANNED_PERMANENTLY",
        "Your account has been permanently banned",
        403,
      );
    }

    // Temporary ban still active
    if (latestBan.expiresAt > now) {
      const formattedDate = latestBan.expiresAt.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "short",
      });

      throw new ServerError(
        "USER_BANNED_TEMPORARILY",
        `Your account is temporarily banned. The ban will expire on ${formattedDate}`,
        403,
      );
    }
  }
}
