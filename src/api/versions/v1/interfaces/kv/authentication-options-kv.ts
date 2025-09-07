import { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/types";

export interface AuthenticationOptionsKV {
  data: PublicKeyCredentialRequestOptionsJSON;
  createdAt: number;
}
