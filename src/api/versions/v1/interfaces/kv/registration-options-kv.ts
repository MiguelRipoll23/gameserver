import { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/types";

export interface RegistrationOptionsKV {
  data: PublicKeyCredentialCreationOptionsJSON;
  created_at: number;
}
