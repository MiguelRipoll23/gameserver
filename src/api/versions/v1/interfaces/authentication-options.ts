import { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/types";

export interface AuthenticationOptionsKV {
  data: PublicKeyCredentialRequestOptionsJSON;
  created_at: number;
}
