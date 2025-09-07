import { inject, injectable } from "@needle-di/core";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { ServerError } from "../models/server-error.ts";
import {
  generateRegistrationOptions,
  PublicKeyCredentialCreationOptionsJSON,
  VerifiedRegistrationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { RegistrationResponseJSON } from "@simplewebauthn/types";
import { AuthenticationService } from "./authentication-service.ts";
import { ConnInfo } from "hono/conninfo";
import { WebAuthnUtils } from "../../../../core/utils/webauthn-utils.ts";
import { AuthenticationResponse } from "../schemas/authentication-schemas.ts";
import {
  GetRegistrationOptionsRequest,
  VerifyRegistrationRequest,
} from "../schemas/registration-schemas.ts";
import { KV_OPTIONS_EXPIRATION_TIME } from "../constants/kv-constants.ts";
import { Base64Utils } from "../../../../core/utils/base64-utils.ts";
import { userCredentialsTable, usersTable } from "../../../../db/schema.ts";
import { eq } from "drizzle-orm";
import { UserCredentialEntity } from "../../../../db/tables/user-credentials-table.ts";
import { UserEntity } from "../../../../db/tables/users-table.ts";
import { KVService } from "./kv-service.ts";

@injectable()
export class RegistrationService {
  constructor(
    private kvService = inject(KVService),
    private databaseService = inject(DatabaseService),
    private authenticationService = inject(AuthenticationService),
  ) {}

  public async getOptions(
    registrationOptionsRequest: GetRegistrationOptionsRequest,
  ): Promise<object> {
    const { transactionId, displayName } = registrationOptionsRequest;
    console.log("Registration options for display name", displayName);

    await this.ensureUserDoesNotExist(displayName);

    const userId = crypto.randomUUID();
    const options = await generateRegistrationOptions({
      rpName: WebAuthnUtils.getRelyingPartyName(),
      rpID: WebAuthnUtils.getRelyingPartyID(),
      userName: displayName,
      userDisplayName: displayName,
      userID: new TextEncoder().encode(userId),
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "required",
        requireResidentKey: true,
      },
    });

    await this.kvService.setRegistrationOptions(transactionId, {
      data: options,
      createdAt: Date.now(),
    });

    return options;
  }

  public async verifyResponse(
    connectionInfo: ConnInfo,
    registrationRequest: VerifyRegistrationRequest,
  ): Promise<AuthenticationResponse> {
    const { transactionId } = registrationRequest;
    const registrationOptions = await this.consumeRegistrationOptionsOrThrow(
      transactionId,
    );

    const registrationResponse = registrationRequest
      .registrationResponse as object as RegistrationResponseJSON;

    const verification = await this.verifyRegistrationResponse(
      registrationResponse,
      registrationOptions,
    );

    const credential = this.createCredential(registrationOptions, verification);
    const user = this.createUser(credential, registrationOptions);

    await this.addCredentialAndUserOrThrow(credential, user);

    return this.authenticationService.getResponseForUser(connectionInfo, user);
  }

  private async ensureUserDoesNotExist(displayName: string): Promise<void> {
    const db = this.databaseService.get();
    const users = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.displayName, displayName))
      .limit(1);

    if (users.length > 0) {
      throw new ServerError(
        "DISPLAY_NAME_TAKEN",
        "Display name is already taken",
        409,
      );
    }
  }

  private async consumeRegistrationOptionsOrThrow(
    transactionId: string,
  ): Promise<PublicKeyCredentialCreationOptionsJSON> {
    const registrationOptions = await this.kvService
      .consumeRegistrationOptionsByTransactionId(
        transactionId,
      );

    if (registrationOptions === null) {
      throw new ServerError(
        "REGISTRATION_OPTIONS_NOT_FOUND",
        "Registration options not found",
        400,
      );
    }

    if (
      registrationOptions.createdAt + KV_OPTIONS_EXPIRATION_TIME <
        Date.now()
    ) {
      throw new ServerError(
        "REGISTRATION_OPTIONS_EXPIRED",
        "Registration options expired",
        400,
      );
    }

    return registrationOptions.data;
  }

  private async verifyRegistrationResponse(
    registrationResponse: RegistrationResponseJSON,
    registrationOptions: PublicKeyCredentialCreationOptionsJSON,
  ): Promise<VerifiedRegistrationResponse> {
    try {
      const verification = await verifyRegistrationResponse({
        response: registrationResponse,
        expectedChallenge: registrationOptions.challenge,
        expectedOrigin: WebAuthnUtils.getRelyingPartyOrigin(),
        expectedRPID: WebAuthnUtils.getRelyingPartyID(),
      });

      if (
        !verification.verified ||
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
        400,
      );
    }
  }

  private createCredential(
    registrationOptions: PublicKeyCredentialCreationOptionsJSON,
    verification: VerifiedRegistrationResponse,
  ): UserCredentialEntity {
    const { registrationInfo } = verification;

    if (!registrationInfo) {
      throw new Error("Registration info not found");
    }

    const userId = Base64Utils.base64UrlToString(registrationOptions.user.id);
    const publicKey = Base64Utils.arrayBufferToBase64Url(
      registrationInfo.credential.publicKey.buffer,
    );

    return {
      id: registrationInfo.credential.id,
      userId,
      publicKey,
      counter: registrationInfo.credential.counter,
      transports: registrationInfo.credential.transports,
      deviceType: registrationInfo.credentialDeviceType,
      backupStatus: registrationInfo.credentialBackedUp,
    };
  }

  private createUser(
    credential: UserCredentialEntity,
    registrationOptions: PublicKeyCredentialCreationOptionsJSON,
  ): UserEntity {
    const { userId } = credential;

    return {
      id: userId,
      displayName: registrationOptions.user.name,
      createdAt: new Date(),
    };
  }

  private async addCredentialAndUserOrThrow(
    credential: UserCredentialEntity,
    user: UserEntity,
  ): Promise<void> {
    const db = this.databaseService.get();

    try {
      await db.transaction(async (tx) => {
        await tx.insert(usersTable).values({
          id: user.id,
          displayName: user.displayName,
          createdAt: new Date(user.createdAt),
        });

        await tx.insert(userCredentialsTable).values({
          id: credential.id,
          userId: credential.userId,
          publicKey: credential.publicKey,
          counter: credential.counter,
          deviceType: credential.deviceType,
          backupStatus: credential.backupStatus,
          transports: credential.transports,
        });
      });

      console.log(`Added credential and user for ${user.displayName}`);
    } catch (error) {
      console.error("Failed to add credential and user:", error);
      throw new ServerError(
        "CREDENTIAL_USER_ADD_FAILED",
        "Failed to add credential and user",
        500,
      );
    }
  }
}
