import { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/server";

export interface RegistrationOptionsKV {
  data: PublicKeyCredentialCreationOptionsJSON;
  createdAt: number;
}
