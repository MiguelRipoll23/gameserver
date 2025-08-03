import { MatchAttributes } from "../match-attributes.ts";

export interface MatchDB {
  token: string;
  version: string;
  totalSlots: number;
  availableSlots: number;
  attributes: MatchAttributes;
}
