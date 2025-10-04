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

    return await this.getResponseForUser(connectionInfo, user);
  }

  public async getResponseForUser(
    connectionInfo: ConnInfo,
    user: UserEntity
  ): Promise<AuthenticationResponse> {
    // Use optimized single query to check user status, bans, and sessions
    const userValidation = await this.getUserValidationData(user.id);

    // Validate ban status
    this.validateUserBanStatus(userValidation.latestBan);

    // Check for active session
    if (userValidation.hasActiveSession) {
      throw new ServerError(
        "USER_ALREADY_SIGNED_IN",
        "Please disconnect from other devices before signing in.",
        409
      );
    }

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
   * Optimized query to get user validation data (ban status and session check) in one query
   */
  private async getUserValidationData(userId: string) {
    try {
      return await this.databaseService.withRlsUser(userId, async (tx) => {
        // Subquery to grab the latest ban for this user
        const latestBanSubquery = tx
          .select({
            id: userBansTable.id,
            expiresAt: userBansTable.expiresAt,
            userId: userBansTable.userId,
          })
          .from(userBansTable)
          .where(eq(userBansTable.userId, usersTable.id))
          .orderBy(desc(userBansTable.createdAt))
          .limit(1)
          .as("latestBan");

        // Subquery to check if a session exists
        const sessionSubquery = tx
          .select({
            userId: userSessionsTable.userId,
          })
          .from(userSessionsTable)
          .where(eq(userSessionsTable.userId, usersTable.id))
          .limit(1)
          .as("activeSession");

        const result = await tx
          .select({
            latestBanExpiresAt: latestBanSubquery.expiresAt,
            hasActiveSession: sessionSubquery.userId,
          })
          .from(usersTable)
          .leftJoin(
            latestBanSubquery,
            eq(latestBanSubquery.userId, usersTable.id)
          )
          .leftJoin(sessionSubquery, eq(sessionSubquery.userId, usersTable.id))
          .where(eq(usersTable.id, userId))
          .limit(1);

        if (result.length === 0) {
          return { latestBan: null, hasActiveSession: false };
        }

        return {
          latestBan: result[0].latestBanExpiresAt
            ? { expiresAt: result[0].latestBanExpiresAt }
            : null,
          hasActiveSession: !!result[0].hasActiveSession,
        };
      });
    } catch (error) {
      console.error("Failed to query user validation data:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to retrieve user validation data",
        500
      );
    }
  }

  /**
   * Validate user ban status using pre-fetched ban data
   */
  private validateUserBanStatus(
    latestBan: { expiresAt: Date | null } | null
  ): void {
    if (!latestBan) {
      return; // No ban found
    }

    // Check for permanent ban
    if (latestBan.expiresAt === null) {
      throw new ServerError(
        "USER_BANNED_PERMANENTLY",
        "Your account is permanently banned.",
        403
      );
    }

    const now = Temporal.Now.instant();

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
        (tx) => {
          return tx
            .select()
            .from(userCredentialsTable)
            .where(eq(userCredentialsTable.id, id))
            .limit(1);
        }
      );

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
      await this.databaseService.withRlsCredential(credential.id, (tx) => {
        return tx
          .update(userCredentialsTable)
          .set({ counter: newCounter })
          .where(
            and(
              eq(userCredentialsTable.id, credential.id),
              lt(userCredentialsTable.counter, newCounter)
            )
          );
      });
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
      const users = await this.databaseService.withRlsUser(userId, (tx) => {
        return tx
          .select()
          .from(usersTable)
          .where(eq(usersTable.id, userId))
          .limit(1);
      });

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
}
