import { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/types";

export interface RegistrationOptionsKV {
  data: PublicKeyCredentialCreationOptionsJSON;
  createdAt: number;
}
