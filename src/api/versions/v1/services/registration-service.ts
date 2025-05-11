import { inject, injectable } from "@needle-di/core";
import { KVService } from "../../../../core/services/kv-service.ts";
import { ServerError } from "../models/server-error.ts";
import {
  generateRegistrationOptions,
  PublicKeyCredentialCreationOptionsJSON,
  VerifiedRegistrationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { RegistrationResponseJSON } from "@simplewebauthn/types";
import { CredentialKV } from "../interfaces/kv/credential-kv.ts";
import { UserKV } from "../interfaces/kv/user-kv.ts";
import { AuthenticationService } from "./authentication-service.ts";
import { ConnInfo } from "hono/conninfo";
import { WebAuthnUtils } from "../../../../core/utils/webauthn-utils.ts";
import { AuthenticationResponse } from "../schemas/authentication-schemas.ts";
import {
  GetRegistrationOptionsRequest,
  VerifyRegistrationRequest,
} from "../schemas/registration-schemas.ts";
import { KV_OPTIONS_EXPIRATION_TIME } from "../constants/kv-constants.ts";

@injectable()
export class RegistrationService {
  constructor(
    private kvService = inject(KVService),
    private authenticationService = inject(AuthenticationService)
  ) {}

  public async getOptions(
    registrationOptionsRequest: GetRegistrationOptionsRequest
  ): Promise<object> {
    const transactionId = registrationOptionsRequest.transaction_id;
    const displayName = registrationOptionsRequest.display_name;
    console.log("Registration options for display name", displayName);

    await this.ensureUserDoesNotExist(displayName);

    const options = await generateRegistrationOptions({
      rpName: WebAuthnUtils.getRelayPartyName(),
      rpID: WebAuthnUtils.getRelayPartyID(),
      userName: displayName,
      userDisplayName: displayName,
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "required",
        requireResidentKey: true,
      },
    });

    await this.kvService.setRegistrationOptions(transactionId, {
      data: options,
      created_at: Date.now(),
    });

    return options;
  }

  public async verifyResponse(
    connectionInfo: ConnInfo,
    registrationRequest: VerifyRegistrationRequest
  ): Promise<AuthenticationResponse> {
    const transactionId = registrationRequest.transaction_id;
    const registrationOptions = await this.getRegistrationOptionsOrThrow(
      transactionId
    );

    await this.kvService.deleteRegistrationOptionsByTransactionId(
      transactionId
    );

    const registrationResponse =
      registrationRequest.registration_response as object as RegistrationResponseJSON;

    const verification = await this.verifyRegistrationResponse(
      registrationResponse,
      registrationOptions
    );

    const credential = this.createCredential(registrationOptions, verification);
    const user = this.createUser(registrationOptions);

    await this.addCredentialAndUserOrThrow(credential, user);

    return this.authenticationService.getResponseForUser(connectionInfo, user);
  }

  private async ensureUserDoesNotExist(displayName: string): Promise<void> {
    const existingUser = await this.kvService.getUserByDisplayName(displayName);

    if (existingUser !== null) {
      throw new ServerError(
        "DISPLAY_NAME_TAKEN",
        "Display name already exists",
        409
      );
    }
  }

  private async getRegistrationOptionsOrThrow(
    transactionId: string
  ): Promise<PublicKeyCredentialCreationOptionsJSON> {
    const registrationOptions =
      await this.kvService.getRegistrationOptionsByTransactionId(transactionId);

    if (registrationOptions === null) {
      throw new ServerError(
        "REGISTRATION_OPTIONS_NOT_FOUND",
        "Registration options not found",
        400
      );
    }

    // Check if the registration options are expired
    const createdAt = registrationOptions.created_at;

    if (createdAt + KV_OPTIONS_EXPIRATION_TIME < Date.now()) {
      throw new ServerError(
        "REGISTRATION_OPTIONS_EXPIRED",
        "Registration options expired",
        400
      );
    }

    return registrationOptions.data;
  }

  private async verifyRegistrationResponse(
    registrationResponse: RegistrationResponseJSON,
    registrationOptions: PublicKeyCredentialCreationOptionsJSON
  ): Promise<VerifiedRegistrationResponse> {
    try {
      const verification = await verifyRegistrationResponse({
        response: registrationResponse,
        expectedChallenge: registrationOptions.challenge,
        expectedOrigin: WebAuthnUtils.getRelayPartyOrigin(),
        expectedRPID: WebAuthnUtils.getRelayPartyID(),
      });

      if (
        verification.verified == false ||
        verification.registrationInfo === undefined
      ) {
        throw new Error("Verification failed or registration info not found");
      }

      return verification;
    } catch (error) {
      console.error(error);

      throw new ServerError(
        "REGISTRATION_VERIFICATION_FAILED",
        "Registration verification failed",
        400
      );
    }
  }

  private createCredential(
    registrationOptions: PublicKeyCredentialCreationOptionsJSON,
    verification: VerifiedRegistrationResponse
  ): CredentialKV {
    const { registrationInfo } = verification;

    if (registrationInfo === undefined) {
      throw new Error("Registration info not found");
    }

    return {
      user_id: registrationOptions.user.id,
      id: registrationInfo.credential.id,
      public_key: registrationInfo.credential.publicKey,
      counter: registrationInfo.credential.counter,
      transports: registrationInfo.credential.transports,
      device_type: registrationInfo.credentialDeviceType,
      backup_status: registrationInfo.credentialBackedUp,
    };
  }

  private createUser(
    registrationOptions: PublicKeyCredentialCreationOptionsJSON
  ): UserKV {
    const userId = registrationOptions.user.id;
    const userDisplayName = registrationOptions.user.name;

    return {
      user_id: userId,
      display_name: userDisplayName,
      created_at: Date.now(),
    };
  }

  private async addCredentialAndUserOrThrow(
    credential: CredentialKV,
    user: UserKV
  ): Promise<void> {
    const result = await this.kvService.setCredentialAndUser(credential, user);

    if (result.ok === false) {
      throw new ServerError(
        "CREDENTIAL_USER_ADD_FAILED",
        "Failed to add credential and user",
        500
      );
    }

    console.log(`Added credential and user for ${user.display_name}`);
  }
}
