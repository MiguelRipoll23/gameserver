import { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/server";

export interface AuthenticationOptionsKV {
  data: PublicKeyCredentialRequestOptionsJSON;
  createdAt: number;
}
