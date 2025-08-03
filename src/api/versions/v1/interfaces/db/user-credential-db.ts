import {
  AuthenticatorTransportFuture,
  CredentialDeviceType,
} from "@simplewebauthn/types";

export interface UserCredentialDB {
  id: string;
  userId: string;
  publicKey: Uint8Array;
  counter: number;
  deviceType: CredentialDeviceType;
  backupStatus: boolean;
  transports: AuthenticatorTransportFuture[] | undefined;
}
