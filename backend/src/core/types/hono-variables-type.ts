import type { JwtVariables } from "hono/jwt";

export type HonoVariables = {
  userId: string;
  userName: string;
  userRoles: string[];
} & JwtVariables;
