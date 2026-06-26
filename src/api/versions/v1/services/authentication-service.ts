import { encodeBase64 } from "hono/utils/encode";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { inject, injectable } from "@needle-di/core";
import { JWTService } from "../../../../core/services/jwt-service.ts";
import { ConnInfo } from "hono/conninfo";
import { WebAuthnUtils } from "../../../../core/utils/webauthn-utils.ts";
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type AuthenticationResponseJSON,
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
  OPTIONS_EXPIRATION_TIME,
  REFRESH_TOKEN_EXPIRATION_SECONDS,
} from "../constants/authentication-constants.ts";
import { UserCredentialEntity } from "../../../../db/tables/user-credentials-table.ts";
import { UserEntity } from "../../../../db/tables/users-table.ts";
import { AuthenticationChallengesService } from "./authentication-challenges-service.ts";
import { RefreshTokensService } from "./refresh-tokens-service.ts";
import { UserEncryptionKeysService } from "./user-encryption-keys-service.ts";
import { SignatureService } from "./signature-service.ts";
import { CredentialsService } from "./credentials-service.ts";
import { UsersService } from "./users-service.ts";
import { UserModerationService } from "./user-moderation-service.ts";
import { SessionsService } from "./sessions-service.ts";
import { AuthenticationUtils } from "../utils/authentication-utils.ts";

@injectable()
export class AuthenticationService {
  constructor(
    private authenticationChallengesService = inject(AuthenticationChallengesService),
    private refreshTokensService = inject(RefreshTokensService),
    private userEncryptionKeysService = inject(UserEncryptionKeysService),
    private databaseService = inject(DatabaseService),
    private jwtService = inject(JWTService),
    private signatureService = inject(SignatureService),
    private iceService = inject(ICEService),
    private credentialsService = inject(CredentialsService),
    private usersService = inject(UsersService),
    private userModerationService = inject(UserModerationService),
    private sessionsService = inject(SessionsService),
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

    await this.authenticationChallengesService.save(
      transactionId,
      "authentication",
      options as unknown as Record<string, unknown>,
    );

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

    const credential = await this.credentialsService.getByIdOrThrow(
      authenticationResponse.id,
    );

    const verification = await this.verifyAuthenticationResponse(
      authenticationResponse,
      authenticationOptions,
      credential,
      origin,
    );

    await this.credentialsService.updateCounter(
      credential.id,
      credential.userId,
      verification.authenticationInfo.newCounter,
    );

    const user = await this.usersService.getByIdOrThrow(credential.userId);
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
    const userRoles = await this.usersService.getRoles(userId);
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
    await this.userEncryptionKeysService.save(userId, userSymmetricKey);

    // Server configuration
    const serverSignaturePublicKey =
      await this.signatureService.getEncodedPublicKey();
    const rtcIceServers = await this.iceService.getServers();

    return {
      accessToken,
      refreshToken,
      userId,
      userDisplayName,
      userRoles,
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
    const refreshTokenHash =
      await AuthenticationUtils.hashToken(refreshToken);
    const tokenData =
      await this.refreshTokensService.consume(refreshTokenHash);

    if (tokenData === null || tokenData.expiresAt <= Date.now()) {
      throw new ServerError(
        "INVALID_REFRESH_TOKEN",
        "Invalid refresh token",
        401,
      );
    }

    console.info(
      JSON.stringify({
        event: "refresh_token_consumed",
        refreshTokenHash,
        userId: tokenData.userId,
        tokenVersion: tokenData.tokenVersion,
      }),
    );

    try {
      const currentTokenVersion =
        await this.refreshTokensService.getVersion(
          tokenData.userId,
        );

      if (tokenData.tokenVersion !== currentTokenVersion) {
        throw new ServerError(
          "TOKEN_VERSION_MISMATCH",
          "Invalid refresh token",
          401,
        );
      }

      const user = await this.usersService.getByIdOrThrow(tokenData.userId);
      await this.ensureUserNotBanned(user);
      await this.sessionsService.ensureHasActiveSession(user.id);
      const userRoles = await this.usersService.getRoles(user.id);

      return {
        accessToken: await this.createAccessToken(
          user.id,
          user.displayName,
          userRoles,
        ),
        refreshToken: await this.createAndStoreRefreshToken(user.id),
      };
    } catch (error) {
      const logPayload = JSON.stringify({
        event: "refresh_token_validation_failed",
        refreshTokenHash,
        userId: tokenData.userId,
        errorCode:
          error instanceof ServerError ? error.getCode() : "UNKNOWN_ERROR",
        errorStatus:
          error instanceof ServerError
            ? error.getStatusCode()
            : "UNKNOWN_STATUS",
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      const expectedRejectionCodes = new Set([
        "USER_BANNED_PERMANENTLY",
        "USER_BANNED_TEMPORARILY",
        "SESSION_NOT_FOUND",
        "TOKEN_VERSION_MISMATCH",
      ]);

      if (
        error instanceof ServerError &&
        expectedRejectionCodes.has(error.getCode())
      ) {
        console.warn(logPayload);
      } else {
        console.error(logPayload);
      }

      // NOTE: This flow is fail-closed. The refresh token has already been
      // consumed atomically before downstream validation. If this stage fails
      // (for example because of transient database/KV issues), the user must
      // re-authenticate to obtain a new token pair.
      throw error;
    }
  }

  private async createAccessToken(
    userId: string,
    userDisplayName: string,
    userRoles: string[],
  ): Promise<string> {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const expSeconds = nowSeconds + ACCESS_TOKEN_EXPIRATION_SECONDS;

    return await this.jwtService.sign({
      sub: userId,
      name: userDisplayName,
      roles: userRoles,
      iat: nowSeconds,
      exp: expSeconds,
    });
  }

  private async createAndStoreRefreshToken(userId: string): Promise<string> {
    const refreshToken = encodeBase64(
      crypto.getRandomValues(new Uint8Array(64)).buffer,
    );
    const refreshTokenHash =
      await AuthenticationUtils.hashToken(refreshToken);
    const expiresAt = Date.now() + REFRESH_TOKEN_EXPIRATION_SECONDS * 1000;
    const tokenVersion = await this.refreshTokensService.getVersion(userId);

    // NOTE: There is a TOCTOU window between reading tokenVersion and writing
    // the refresh token entry. If invalidation runs in between, this token can
    // be immediately stale. This is intentionally fail-closed (safe) but may
    // feel confusing to users. Avoiding it would require an atomic,
    // cross-key transactional approach.
    await this.refreshTokensService.save(
      refreshTokenHash,
      userId,
      new Date(expiresAt),
      tokenVersion,
    );

    return refreshToken;
  }

  private async getAuthenticationOptionsOrThrow(
    transactionId: string,
  ): Promise<PublicKeyCredentialRequestOptionsJSON> {
    const challenge = await this.authenticationChallengesService.consume<PublicKeyCredentialRequestOptionsJSON>(
      transactionId,
      "authentication",
    );

    if (challenge === null) {
      throw new ServerError(
        "AUTHENTICATION_OPTIONS_NOT_FOUND",
        "Authentication options not found",
        400,
      );
    }

    if (challenge.createdAt.getTime() + OPTIONS_EXPIRATION_TIME < Date.now()) {
      throw new ServerError(
        "AUTHENTICATION_OPTIONS_EXPIRED",
        "Authentication options expired",
        400,
      );
    }

    return challenge.data;
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
        credential: AuthenticationUtils.transformCredentialForWebAuthn(credential),
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

  private async ensureUserCanSignIn(user: UserEntity): Promise<void> {
    const [banResult, sessionResult] = await Promise.allSettled([
      this.ensureUserNotBanned(user),
      this.sessionsService.ensureHasNoActiveSession(user.id),
    ]);

    if (banResult.status === "rejected") {
      throw banResult.reason;
    }

    if (sessionResult.status === "rejected") {
      throw sessionResult.reason;
    }
  }

  private async ensureUserNotBanned(user: UserEntity): Promise<void> {
    await this.databaseService.executeWithUserContext(user.id, async (tx) => {
      await this.userModerationService.throwIfBanned(tx, user.id);
    });
  }
}
