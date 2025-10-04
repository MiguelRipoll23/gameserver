import { encodeBase64 } from "honimport { and, eq, lt, sql } from \"drizzle-orm\";/utils/encode";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { create } from "@wok/djwt";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
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
import { and, eq, lt, sql, placeholder } from "drizzle-orm";
import { UserCredentialEntity } from "../../../../db/tables/user-credentials-table.ts";
import { UserEntity } from "../../../../db/tables/users-table.ts";
import { desc } from "drizzle-orm";
import { KVService } from "./kv-service.ts";
import { SignatureService } from "./signature-service.ts";

@injectable()
export class AuthenticationService {
  // Prepared statements for better performance - initialized after constructor  
  private preparedGetCredential: any;
  private preparedGetUser: any;
  private preparedGetUserRoles: any;
  private preparedGetLatestUserBan: any;
  private preparedCheckUserSession: any;
  private preparedUpdateCredentialCounter: any;
  private preparedGetUserWithChecks: any;

  constructor(
    private kvService = inject(KVService),
    private databaseService = inject(DatabaseService),
    private jwtService = inject(JWTService),
    private signatureService = inject(SignatureService),
    private iceService = inject(ICEService)
  ) {
    // Initialize prepared statements
    this.initializePreparedStatements();
  }

  private initializePreparedStatements() {
    const db = this.databaseService.get();
    
    this.preparedGetCredential = db
      .select()
      .from(userCredentialsTable)
      .where(eq(userCredentialsTable.id, placeholder("credentialId")))
      .limit(1)
      .prepare("getCredential");

    this.preparedGetUser = db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, placeholder("userId")))
      .limit(1)
      .prepare("getUser");

    this.preparedGetUserRoles = db
      .select({ name: rolesTable.name })
      .from(userRolesTable)
      .innerJoin(rolesTable, eq(userRolesTable.roleId, rolesTable.id))
      .where(eq(userRolesTable.userId, placeholder("userId")))
      .prepare("getUserRoles");

    this.preparedGetLatestUserBan = db
      .select({ expiresAt: userBansTable.expiresAt })
      .from(userBansTable)
      .where(eq(userBansTable.userId, placeholder("userId")))
      .orderBy(desc(userBansTable.createdAt))
      .limit(1)
      .prepare("getLatestUserBan");

    this.preparedCheckUserSession = db
      .select({ userId: userSessionsTable.userId })
      .from(userSessionsTable)
      .where(eq(userSessionsTable.userId, placeholder("userId")))
      .limit(1)
      .prepare("checkUserSession");

    this.preparedUpdateCredentialCounter = db
      .update(userCredentialsTable)
      .set({ counter: placeholder("newCounter") })
      .where(
        and(
          eq(userCredentialsTable.id, placeholder("credentialId")),
          lt(userCredentialsTable.counter, placeholder("newCounter"))
        )
      )
      .prepare("updateCredentialCounter");

    // Optimized query to get user with ban status and session check in one query
    this.preparedGetUserWithChecks = db
      .select({
        user: {
          id: usersTable.id,
          displayName: usersTable.displayName,
          createdAt: usersTable.createdAt,
        },
        latestBanExpiresAt: userBansTable.expiresAt,
        hasActiveSession: userSessionsTable.userId,
      })
      .from(usersTable)
      .leftJoin(
        userBansTable,
        and(
          eq(userBansTable.userId, usersTable.id),
          // Only get the latest ban using a subquery approach
          eq(
            userBansTable.id,
            sql`(SELECT id FROM user_bans WHERE user_id = ${usersTable.id} ORDER BY created_at DESC LIMIT 1)`
          )
        )
      )
      .leftJoin(userSessionsTable, eq(userSessionsTable.userId, usersTable.id))
      .where(eq(usersTable.id, placeholder("userId")))
      .limit(1)
      .prepare("getUserWithChecks");
  }

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

    return await this.getResponseForUser(connectionInfo, user);
  }

  public async getResponseForUser(
    connectionInfo: ConnInfo,
    user: UserEntity
  ): Promise<AuthenticationResponse> {
    // Use optimized query to check user, ban status, and session in one call
    const userCheckResult = await this.getUserWithValidationChecks(user.id);
    
    if (!userCheckResult.user) {
      throw new ServerError("USER_NOT_FOUND", "User not found", 400);
    }

    // Validate ban status
    this.validateUserBanStatus(userCheckResult.latestBanExpiresAt);

    // Check for active session
    if (userCheckResult.hasActiveSession) {
      throw new ServerError(
        "USER_ALREADY_SIGNED_IN",
        "Please disconnect from other devices before signing in.",
        409
      );
    }

    const userId = userCheckResult.user.id;
    const userDisplayName = userCheckResult.user.displayName;
    const userPublicIp = connectionInfo.remote.address ?? null;

    // Fetch user roles
    const userRoles = await this.getUserRoles(userId);

    // Create JWT for client authentication
    const jwtKey = await this.jwtService.getKey();

    const authenticationToken = await create(
      { alg: "HS512", typ: "JWT" },
      { id: userId, name: userDisplayName, roles: userRoles },
      jwtKey
    );

    // Add user symmetric key for encryption/decryption
    const userSymmetricKey: string = encodeBase64(
      crypto.getRandomValues(new Uint8Array(32)).buffer
    );

    await this.kvService.setUserKey(userId, userSymmetricKey);

    // Server configuration
    const serverSignaturePublicKey =
      this.signatureService.getEncodedPublicKey();
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

  /**
   * Optimized method that gets user data with ban and session checks in a single query
   */
  private async getUserWithValidationChecks(userId: string) {
    try {
      const result = await this.databaseService.withRlsUser(
        userId,
        () => this.preparedGetUserWithChecks.execute({ userId })
      ) as Array<{
        user: { id: string; displayName: string; createdAt: Date };
        latestBanExpiresAt: Date | null;
        hasActiveSession: string | null;
      }>;

      if (result.length === 0) {
        return { user: null, latestBanExpiresAt: null, hasActiveSession: null };
      }

      return result[0];
    } catch (error) {
      console.error("Failed to query user with checks:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to retrieve user data",
        500
      );
    }
  }

  /**
   * Validate user ban status using pre-fetched ban data
   */
  private validateUserBanStatus(latestBanExpiresAt: Date | null): void {
    if (!latestBanExpiresAt) {
      return; // No ban found
    }

    const now = Temporal.Now.instant();

    // Permanent ban
    if (!latestBanExpiresAt) {
      throw new ServerError(
        "USER_BANNED_PERMANENTLY",
        "Your account has been permanently banned",
        403
      );
    }

    // Temporary ban still active
    if (
      Temporal.Instant.from(latestBanExpiresAt.toISOString())
        .epochMilliseconds > now.epochMilliseconds
    ) {
      const formattedDate = Temporal.Instant.from(
        latestBanExpiresAt.toISOString()
      )
        .toZonedDateTimeISO(Temporal.Now.timeZoneId())
        .toLocaleString("en-US", {
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
        403
      );
    }
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

    // Check if the authentication options are expired
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
      const credentials = await this.databaseService.withRlsCredential(
        id,
        () => this.preparedGetCredential.execute({ credentialId: id })
      ) as UserCredentialEntity[];

      if (credentials.length === 0) {
        throw new ServerError(
          "CREDENTIAL_NOT_FOUND",
          "Credential not found",
          400
        );
      }

      return credentials[0];
    } catch (error) {
      if (error instanceof ServerError) {
        throw error;
      }
      console.error("Failed to query credential:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to retrieve credential",
        500
      );
    }
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
    const newCounter = authenticationInfo.newCounter;

    try {
      await this.databaseService.withRlsCredential(
        credential.id,
        () => this.preparedUpdateCredentialCounter.execute({
          credentialId: credential.id,
          newCounter
        })
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
      const users = await this.databaseService.withRlsUser(
        userId,
        () => this.preparedGetUser.execute({ userId })
      ) as UserEntity[];

      if (users.length === 0) {
        throw new ServerError("USER_NOT_FOUND", "User not found", 400);
      }

      return users[0];
    } catch (error) {
      if (error instanceof ServerError) {
        throw error;
      }
      console.error("Failed to query user:", error);
      throw new ServerError("DATABASE_ERROR", "Failed to retrieve user", 500);
    }
  }

  private async getUserRoles(userId: string): Promise<string[]> {
    try {
      const userRoleResults = await this.databaseService.withRlsUser(
        userId,
        () => this.preparedGetUserRoles.execute({ userId })
      ) as Array<{ name: string }>;

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

  private async ensureUserNotBanned(user: UserEntity): Promise<void> {
    try {
      const userBans = await this.databaseService.withRlsUser(
        user.id,
        () => this.preparedGetLatestUserBan.execute({ userId: user.id })
      ) as Array<{ expiresAt: Date | null }>;

      if (userBans.length === 0) {
        return;
      }

      const latestBan = userBans[0];
      const now = Temporal.Now.instant();

      // Permanent ban
      if (!latestBan.expiresAt) {
        throw new ServerError(
          "USER_BANNED_PERMANENTLY",
          "Your account has been permanently banned",
          403
        );
      }

      // Temporary ban still active
      if (
        Temporal.Instant.from(latestBan.expiresAt.toISOString())
          .epochMilliseconds > now.epochMilliseconds
      ) {
        const formattedDate = Temporal.Instant.from(
          latestBan.expiresAt.toISOString()
        )
          .toZonedDateTimeISO(Temporal.Now.timeZoneId())
          .toLocaleString("en-US", {
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
          403
        );
      }
    } catch (error) {
      if (error instanceof ServerError) {
        throw error;
      }
      console.error("Failed to query user bans:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to retrieve user bans",
        500
      );
    }
  }

  private async ensureUserHasNoActiveSession(user: UserEntity): Promise<void> {
    try {
      const existingSessions = await this.databaseService.withRlsUser(
        user.id,
        () => this.preparedCheckUserSession.execute({ userId: user.id })
      ) as Array<{ userId: string }>;

      if (existingSessions.length > 0) {
        throw new ServerError(
          "USER_ALREADY_SIGNED_IN",
          "Please disconnect from other devices before signing in.",
          409
        );
      }
    } catch (error) {
      if (error instanceof ServerError) {
        throw error;
      }
      console.error("Failed to query user sessions:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to check for existing sessions",
        500
      );
    }
  }
}
