export interface BanInformation {
  reason: string;
  expiresAt: number | null;
}

export interface UserDB {
  userId: string;
  displayName: string;
  createdAt: number;
  ban?: BanInformation;
}
