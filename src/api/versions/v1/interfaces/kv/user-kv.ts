export interface BanInformation {
  reason: string;
  expiresAt: number | null;
}

export interface UserKV {
  userId: string;
  displayName: string;
  createdAt: number;
  ban?: BanInformation;
}
