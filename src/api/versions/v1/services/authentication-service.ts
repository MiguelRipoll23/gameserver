import { encodeBase64 } from "hono/utils/encode";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { create } from "@wok/djwt";
import { Base64Utils } from "../../../../core/utils/base64-utils.ts";
import { inject, injectable } from "@needle-di/core";
import { JWTService } from "../../../../core/services/jwt-service.ts";
import { ConnInfo } from "hono/conninfo";
import { WebAuthnUtils } from "../../../../core/utils/webauthn-utils.ts";
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type PublicKeyCredentialRequestOptionsJSON,
  type VerifiedAuthenticationResponse,
} from "@simplewebauthn/server";
import { ServerError } from "../models/server-error.ts";
import { ICEService } from "./ice-service.ts";
import {
  AuthenticationResponse,
  GetAuthenticationOptionsRequest,
  RefreshTokenRequest,
  RefreshTokenResponse,
  VerifyAuthenticationRequest,
} from "../schemas/authentication-schemas.ts";
import {
  ACCESS_TOKEN_EXPIRATION_SECONDS,
  KV_OPTIONS_EXPIRATION_TIME,
  REFRESH_TOKEN_EXPIRATION_SECONDS,
  SESSION_LIFETIME_SECONDS,
} from "../constants/kv-constants.ts";
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
    private iceService = inject(ICEService),
  ) {}

  public async getOptions(
    authenticationRequest: GetAuthenticationOptionsRequest,
    origin: string,
  ): Promise<object> {
    const { transactionId } = authenticationRequest;

    if (!WebAuthnUtils.isOriginAllowed(origin)) {
      throw new ServerError(
        "ORIGIN_NOT_ALLOWED",
        "Origin is not in the allowed list",
        403,
      );
    }

    const rpID = WebAuthnUtils.getRelyingPartyIDFromOrigin(origin);
    const options = await generateAuthenticationOptions({
      rpID,
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
    authenticationRequest: VerifyAuthenticationRequest,
    origin: string,
  ): Promise<AuthenticationResponse> {
    const { transactionId } = authenticationRequest;
    const authenticationResponse =
      authenticationRequest.authenticationResponse as object as AuthenticationResponseJSON;

    if (!WebAuthnUtils.isOriginAllowed(origin)) {
      throw new ServerError(
        "ORIGIN_NOT_ALLOWED",
        "Origin is not in the allowed list",
        403,
      );
    }

    const authenticationOptions =
      await this.getAuthenticationOptionsOrThrow(transactionId);

    const credential = await this.getCredentialOrThrow(
      authenticationResponse.id,
    );

    const verification = await this.verifyAuthenticationResponse(
      authenticationResponse,
      authenticationOptions,
      credential,
      origin,
    );

    await this.updateCredentialCounter(credential, verification);

    const user = await this.getUserOrThrowError(credential);
    await this.ensureUserCanSignIn(user);

    return await this.getResponseForUser(connectionInfo, user);
  }

  public async getResponseForUser(
    connectionInfo: ConnInfo,
    user: UserEntity,
  ): Promise<AuthenticationResponse> {
    const userId = user.id;
    const userDisplayName = user.displayName;
    const userPublicIp = connectionInfo.remote.address ?? null;
    const userRoles = await this.getUserRoles(userId);
    const accessToken = await this.createAccessToken(
      userId,
      userDisplayName,
      userRoles,
    );
    const refreshToken = await this.createAndStoreRefreshToken(userId);

    // Generate and store symmetric key for this user session
    const userSymmetricKey: string = encodeBase64(
      crypto.getRandomValues(new Uint8Array(32)).buffer,
    );
    await this.kvService.setUserKey(userId, userSymmetricKey);

    // Server configuration
    const serverSignaturePublicKey =
      this.signatureService.getEncodedPublicKey();
    const rtcIceServers = await this.iceService.getServers();

    return {
      accessToken,
      refreshToken,
      userId,
      userDisplayName,
      userPublicIp,
      userSymmetricKey,
      serverSignaturePublicKey,
      rtcIceServers,
    };
  }

  public async refreshTokens(
    refreshRequest: RefreshTokenRequest,
  ): Promise<RefreshTokenResponse> {
    const { refreshToken } = refreshRequest;
    const refreshTokenHash = await this.hashToken(refreshToken);
    const tokenData = await this.kvService.consumeRefreshToken(refreshTokenHash);

    if (tokenData === null || tokenData.expiresAt <= Date.now()) {
      throw new ServerError("INVALID_REFRESH_TOKEN", "Invalid refresh token", 401);
    }

    const user = await this.getUserByIdOrThrow(tokenData.userId);
    await this.ensureUserNotBanned(user);
    const userRoles = await this.getUserRoles(user.id);

    return {
      accessToken: await this.createAccessToken(user.id, user.displayName, userRoles),
      refreshToken: await this.createAndStoreRefreshToken(user.id),
    };
  }

  private async createAccessToken(
    userId: string,
    userDisplayName: string,
    userRoles: string[],
  ): Promise<string> {
    const jwtKey = await this.jwtService.getKey();
    const nowSeconds = Math.floor(Date.now() / 1000);
    const expSeconds = nowSeconds + ACCESS_TOKEN_EXPIRATION_SECONDS;

    return await create(
      { alg: "HS512", typ: "JWT" },
      { id: userId, name: userDisplayName, roles: userRoles, exp: expSeconds },
      jwtKey,
    );
  }

  private async createAndStoreRefreshToken(userId: string): Promise<string> {
    const refreshToken = encodeBase64(
      crypto.getRandomValues(new Uint8Array(64)).buffer,
    );
    const refreshTokenHash = await this.hashToken(refreshToken);
    const expiresAt = Date.now() + REFRESH_TOKEN_EXPIRATION_SECONDS * 1000;

    await this.kvService.setRefreshToken(refreshTokenHash, {
      userId,
      expiresAt,
    });

    return refreshToken;
  }

  private async hashToken(token: string): Promise<string> {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(token),
    );

    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  private async getAuthenticationOptionsOrThrow(
    transactionId: string,
  ): Promise<PublicKeyCredentialRequestOptionsJSON> {
    const authenticationOptions =
      await this.kvService.takeAuthenticationOptionsByTransactionId(
        transactionId,
      );

    if (authenticationOptions === null) {
      throw new ServerError(
        "AUTHENTICATION_OPTIONS_NOT_FOUND",
        "Authentication options not found",
        400,
      );
    }

    const createdAt = authenticationOptions.createdAt;

    if (createdAt + KV_OPTIONS_EXPIRATION_TIME < Date.now()) {
      throw new ServerError(
        "AUTHENTICATION_OPTIONS_EXPIRED",
        "Authentication options expired",
        400,
      );
    }

    return authenticationOptions.data;
  }

  private async getCredentialOrThrow(
    id: string,
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
          400,
        );
      }

      return credentials[0];
    } catch (error) {
      if (error instanceof ServerError) throw error;
      console.error("Failed to query credential:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to retrieve credential",
        500,
      );
    }
  }

  private transformCredentialForWebAuthn(credential: UserCredentialEntity) {
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
    origin: string,
  ): Promise<VerifiedAuthenticationResponse> {
    try {
      const rpID = WebAuthnUtils.getRelyingPartyIDFromOrigin(origin);
      const verification = await verifyAuthenticationResponse({
        response: authenticationResponse,
        expectedChallenge: authenticationOptions.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: this.transformCredentialForWebAuthn(credential),
      });

      if (!verification.verified) {
        throw new ServerError(
          "AUTHENTICATION_FAILED",
          "Authentication failed",
          400,
        );
      }

      return verification;
    } catch (error) {
      console.error(error);
      if (error instanceof ServerError) throw error;
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
      await this.databaseService.executeWithCredentialContext(
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
            );
        },
      );
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

    try {
      const users = await this.databaseService.executeWithUserContext(
        userId,
        (tx) => {
          return tx
            .select()
            .from(usersTable)
            .where(eq(usersTable.id, userId))
            .limit(1);
        },
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

  private async getUserByIdOrThrow(userId: string): Promise<UserEntity> {
    try {
      const users = await this.databaseService.executeWithUserContext(
        userId,
        (tx) => {
          return tx
            .select()
            .from(usersTable)
            .where(eq(usersTable.id, userId))
            .limit(1);
        },
      );

      if (users.length === 0) {
        throw new ServerError("USER_NOT_FOUND", "User not found", 400);
      }

      return users[0];
    } catch (error) {
      if (error instanceof ServerError) throw error;
      console.error("Failed to query user by id:", error);
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
        },
      );

      return userRoleResults.map((role: { name: string }) => role.name);
    } catch (error) {
      console.error("Failed to query user roles:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to retrieve user roles",
        500,
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
                sql`${userSessionsTable.updatedAt} >= NOW() - INTERVAL '${SESSION_LIFETIME_SECONDS} seconds'`,
              ),
            )
            .limit(1);
        });

      if (existingSessions.length > 0) {
        throw new ServerError(
          "USER_ALREADY_SIGNED_IN",
          "Please disconnect from other devices before signing in.",
          409,
        );
      }
    } catch (error) {
      if (error instanceof ServerError) throw error;
      console.error("Failed to query user sessions:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to check for existing sessions",
        500,
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
        },
      );

      if (userBans.length === 0) return;

      const latestBan = userBans[0];
      const now = new Date();

      if (!latestBan.expiresAt) {
        throw new ServerError(
          "USER_BANNED_PERMANENTLY",
          "Your account has been permanently banned",
          403,
        );
      }

      if (latestBan.expiresAt > now) {
        const formattedDate = latestBan.expiresAt.toLocaleString("en-US", {
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          dateStyle: "medium",
          timeStyle: "long",
        });

        throw new ServerError(
          "USER_BANNED_TEMPORARILY",
          `Your account is temporarily banned until ${formattedDate}.`,
          403,
        );
      }
    } catch (error) {
      if (error instanceof ServerError) throw error;
      console.error("Failed to query user bans:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to retrieve user bans",
        500,
      );
    }
  }
}
