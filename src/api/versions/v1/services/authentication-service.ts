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
  rolesTable,
  userBansTable,
  userCredentialsTable,
  userRolesTable,
  userSessionsTable,
  usersTable,
} from "../../../../db/schema.ts";
import { and, eq, lt, desc, sql } from "drizzle-orm";
import { UserCredentialEntity } from "../../../../db/tables/user-credentials-table.ts";
import { UserEntity } from "../../../../db/tables/users-table.ts";
import { KVService } from "./kv-service.ts";
import { SignatureService } from "./signature-service.ts";

@injectable()
export class AuthenticationService {
  constructor(
    private kvService = inject(KVService),
    private databaseService = inject(DatabaseService),
    private jwtService = inject(JWTService),
    private signatureService = inject(SignatureService),
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
      createdAt: Temporal.Now.instant().epochMilliseconds,
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

    const credential = await this.getCredentialOrThrow(
      authenticationResponse.id
    );

    const verification = await this.verifyAuthenticationResponse(
      authenticationResponse,
      authenticationOptions,
      credential
    );

    await this.updateCredentialCounter(credential, verification);

    const user = await this.getUserOrThrowError(credential);
    await this.ensureUserCanSignIn(user);

    return await this.getResponseForUser(connectionInfo, user);
  }

  public async getResponseForUser(
    connectionInfo: ConnInfo,
    user: UserEntity
  ): Promise<AuthenticationResponse> {
    const userId = user.id;
    const userDisplayName = user.displayName;
    const userPublicIp = connectionInfo.remote.address ?? null;
    const userRoles = await this.getUserRoles(userId);

    // Create JWT for client authentication
    const jwtKey = await this.jwtService.getKey();
    const authenticationToken = await create(
      { alg: "HS512", typ: "JWT" },
      { id: userId, name: userDisplayName, roles: userRoles },
      jwtKey
    );

    // Generate and store symmetric key for this user session
    const userSymmetricKey: string = encodeBase64(
      crypto.getRandomValues(new Uint8Array(32)).buffer
    );
    await this.kvService.setUserKey(userId, userSymmetricKey);

    // Server configuration
    const serverSignaturePublicKey =
      this.signatureService.getEncodedPublicKey();
    const rtcIceServers = await this.iceService.getServers();

    return {
      authenticationToken,
      userId,
      userDisplayName,
      userPublicIp,
      userSymmetricKey,
      serverSignaturePublicKey,
      rtcIceServers,
    };
  }

  private async getAuthenticationOptionsOrThrow(
    transactionId: string
  ): Promise<PublicKeyCredentialRequestOptionsJSON> {
    const authenticationOptions =
      await this.kvService.takeAuthenticationOptionsByTransactionId(
        transactionId
      );

    if (authenticationOptions === null) {
      throw new ServerError(
        "AUTHENTICATION_OPTIONS_NOT_FOUND",
        "Authentication options not found",
        400
      );
    }

    const createdAt = authenticationOptions.createdAt;

    if (
      createdAt + KV_OPTIONS_EXPIRATION_TIME <
      Temporal.Now.instant().epochMilliseconds
    ) {
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
    try {
      const credentials =
        await this.databaseService.executeWithCredentialContext(id, (tx) => {
          return tx
            .select()
            .from(userCredentialsTable)
            .where(eq(userCredentialsTable.id, id))
            .limit(1);
        });

      if (credentials.length === 0) {
        throw new ServerError(
          "CREDENTIAL_NOT_FOUND",
          "Credential not found",
          400
        );
      }

      return credentials[0];
    } catch (error) {
      if (error instanceof ServerError) throw error;
      console.error("Failed to query credential:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to retrieve credential",
        500
      );
    }
  }

  private transformCredentialForWebAuthn(credential: UserCredentialEntity) {
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
    credential: UserCredentialEntity
  ): Promise<VerifiedAuthenticationResponse> {
    try {
      const verification = await verifyAuthenticationResponse({
        response: authenticationResponse,
        expectedChallenge: authenticationOptions.challenge,
        expectedOrigin: WebAuthnUtils.getRelyingPartyOrigin(),
        expectedRPID: WebAuthnUtils.getRelyingPartyID(),
        credential: this.transformCredentialForWebAuthn(credential),
      });

      if (!verification.verified) {
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
    const newCounter = authenticationInfo.newCounter;

    try {
      await this.databaseService.executeWithCredencialContext(
        credential.id,
        (tx) => {
          return tx
            .update(userCredentialsTable)
            .set({ counter: newCounter })
            .where(
              and(
                eq(userCredentialsTable.id, credential.id),
                lt(userCredentialsTable.counter, newCounter)
              )
            );
        }
      );
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
    credential: UserCredentialEntity
  ): Promise<UserEntity> {
    const userId = credential.userId;

    try {
      const users = await this.databaseService.executeWithUserContext(
        userId,
        (tx) => {
          return tx
            .select()
            .from(usersTable)
            .where(eq(usersTable.id, userId))
            .limit(1);
        }
      );

      if (users.length === 0) {
        throw new ServerError("USER_NOT_FOUND", "User not found", 400);
      }

      return users[0];
    } catch (error) {
      if (error instanceof ServerError) throw error;
      console.error("Failed to query user:", error);
      throw new ServerError("DATABASE_ERROR", "Failed to retrieve user", 500);
    }
  }

  private async getUserRoles(userId: string): Promise<string[]> {
    try {
      const userRoleResults = await this.databaseService.executeWithUserContext(
        userId,
        (tx) => {
          return tx
            .select({ name: rolesTable.name })
            .from(userRolesTable)
            .innerJoin(rolesTable, eq(userRolesTable.roleId, rolesTable.id))
            .where(eq(userRolesTable.userId, userId));
        }
      );

      return userRoleResults.map((role: { name: string }) => role.name);
    } catch (error) {
      console.error("Failed to query user roles:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to retrieve user roles",
        500
      );
    }
  }

  private async ensureUserCanSignIn(user: UserEntity): Promise<void> {
    const [banResult, sessionResult] = await Promise.allSettled([
      this.ensureUserNotBanned(user),
      this.ensureUserHasNoActiveSession(user),
    ]);

    if (banResult.status === "rejected") {
      throw banResult.reason;
    }

    if (sessionResult.status === "rejected") {
      throw sessionResult.reason;
    }
  }

  private async ensureUserHasNoActiveSession(user: UserEntity): Promise<void> {
    try {
      const existingSessions =
        await this.databaseService.executeWithUserContext(user.id, (tx) => {
          return tx
            .select({ userId: userSessionsTable.userId })
            .from(userSessionsTable)
            .where(
              and(
                eq(userSessionsTable.userId, user.id),
                sql`${userSessionsTable.updatedAt} >= NOW() - INTERVAL '24 hours'`
              )
            )
            .limit(1);
        });

      if (existingSessions.length > 0) {
        throw new ServerError(
          "USER_ALREADY_SIGNED_IN",
          "Please disconnect from other devices before signing in.",
          409
        );
      }
    } catch (error) {
      if (error instanceof ServerError) throw error;
      console.error("Failed to query user sessions:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to check for existing sessions",
        500
      );
    }
  }

  private async ensureUserNotBanned(user: UserEntity): Promise<void> {
    try {
      const userBans = await this.databaseService.executeWithUserContext(
        user.id,
        (tx) => {
          return tx
            .select({ expiresAt: userBansTable.expiresAt })
            .from(userBansTable)
            .where(eq(userBansTable.userId, user.id))
            .orderBy(desc(userBansTable.createdAt))
            .limit(1);
        }
      );

      if (userBans.length === 0) return;

      const latestBan = userBans[0];
      const nowInstant = Temporal.Now.instant();

      if (!latestBan.expiresAt) {
        throw new ServerError(
          "USER_BANNED_PERMANENTLY",
          "Your account has been permanently banned",
          403
        );
      }

      const expiresInstant = Temporal.Instant.from(
        latestBan.expiresAt.toISOString()
      );

      if (expiresInstant > nowInstant) {
        const localExpiry = expiresInstant.toZonedDateTimeISO(
          Temporal.Now.timeZoneId()
        );
        const formattedDate = localExpiry.toLocaleString("en-US", {
          dateStyle: "medium",
          timeStyle: "long",
          timeZoneName: "short",
        });

        throw new ServerError(
          "USER_BANNED_TEMPORARILY",
          `Your account is temporarily banned until ${formattedDate}.`,
          403
        );
      }
    } catch (error) {
      if (error instanceof ServerError) throw error;
      console.error("Failed to query user bans:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to retrieve user bans",
        500
      );
    }
  }
}
