import { encodeBase64 } from "hono/utils/encode";
import { UserKV } from "../interfaces/kv/user-kv.ts";
import { KVService } from "../../../../core/services/kv-service.ts";
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
import { CredentialKV } from "../interfaces/kv/credential-kv.ts";
import { ServerError } from "../models/server-error.ts";
import { ICEService } from "./ice-service.ts";
import {
  AuthenticationResponse,
  GetAuthenticationOptionsRequest,
  VerifyAuthenticationRequest,
} from "../schemas/authentication-schemas.ts";
import { KV_OPTIONS_EXPIRATION_TIME } from "../constants/kv-constants.ts";

@injectable()
export class AuthenticationService {
  constructor(
    private kvService = inject(KVService),
    private jwtService = inject(JWTService),
    private iceService = inject(ICEService)
  ) {}

  public async getOptions(
    authenticationRequest: GetAuthenticationOptionsRequest
  ): Promise<object> {
    const transactionId = authenticationRequest.transaction_id;

    const options = await generateAuthenticationOptions({
      rpID: WebAuthnUtils.getRelayPartyID(),
      userVerification: "preferred",
    });

    await this.kvService.setAuthenticationOptions(transactionId, {
      data: options,
      created_at: Date.now(),
    });

    return options;
  }

  public async verifyResponse(
    connectionInfo: ConnInfo,
    authenticationRequest: VerifyAuthenticationRequest
  ): Promise<AuthenticationResponse> {
    const transactionId = authenticationRequest.transaction_id;
    const authenticationResponse =
      authenticationRequest.authentication_response as object as AuthenticationResponseJSON;

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

    const userKV = await this.getUserOrThrow(credentialKV);

    return await this.getResponseForUser(connectionInfo, userKV);
  }

  public async getResponseForUser(
    connectionInfo: ConnInfo,
    user: UserKV
  ): Promise<AuthenticationResponse> {
    const key = await this.jwtService.getKey();
    const publicIp = connectionInfo.remote.address ?? null;
    const userId = user.user_id;
    const userDisplayName = user.display_name;

    // Create JWT for client authentication
    const authenticationToken = await create(
      { alg: "HS512", typ: "JWT" },
      { id: userId, name: userDisplayName },
      key
    );

    // Add user key for encryption/decryption
    const userKey: string = encodeBase64(
      crypto.getRandomValues(new Uint8Array(32)).buffer
    );

    await this.kvService.setKey(userId, userKey);

    // ICE servers
    const iceServers = await this.iceService.getServers();

    const response: AuthenticationResponse = {
      user_id: userId,
      display_name: userDisplayName,
      authentication_token: authenticationToken,
      session_key: userKey,
      public_ip: publicIp,
      rtc_ice_servers: iceServers,
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
    const createdAt = authenticationOptions.created_at;

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
    const credential = await this.kvService.getCredential(id);

    if (credential === null) {
      throw new ServerError(
        "CREDENTIAL_NOT_FOUND",
        "Credential not found",
        400
      );
    }

    return credential;
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
        expectedOrigin: WebAuthnUtils.getRelayPartyOrigin(),
        expectedRPID: WebAuthnUtils.getRelayPartyID(),
        credential: {
          id: credentialKV.id,
          publicKey: credentialKV.public_key,
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

    await this.kvService.setCredential(credential.id, credential);
  }

  private async getUserOrThrow(credentialKV: CredentialKV): Promise<UserKV> {
    const userId = credentialKV.user_id;
    const user = await this.kvService.getUser(userId);

    if (user === null) {
      throw new ServerError("USER_NOT_FOUND", "User not found", 400);
    }

    return {
      ...user,
      user_id: userId.length === 32 ? userId : userId.substring(0, 32), // for older format
    };
  }
}
