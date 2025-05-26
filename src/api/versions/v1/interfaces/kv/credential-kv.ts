import {
  AuthenticatorTransportFuture,
  CredentialDeviceType,
} from "@simplewebauthn/types";

export interface CredentialKV {
  id: string;
  publicKey: Uint8Array;
  userId: string;
  counter: number;
  deviceType: CredentialDeviceType;
  backupStatus: boolean;
  transports: AuthenticatorTransportFuture[] | undefined;
}
