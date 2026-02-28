export interface PlayerIdentityPayload {
  destinationToken: string;
  originToken: Uint8Array;
  originNetworkId: string;
  originName: string;
}
