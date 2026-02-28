// JWT payload type for authentication middleware
export interface JWTPayload {
  sub: string;
  name: string;
  roles: unknown;
  [key: string]: unknown;
}
