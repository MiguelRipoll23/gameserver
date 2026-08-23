export interface PlayerIdentityPayload {
  destinationToken: string;
  originTokenBytes: Uint8Array;
  originNetworkId: string;
  originName: string;
}
