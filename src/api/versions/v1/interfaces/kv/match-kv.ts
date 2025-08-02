import { MatchAttributesKV } from "./match-attributes.ts";

export interface MatchKV {
  token: string;
  version: string;
  totalSlots: number;
  availableSlots: number;
  attributes: MatchAttributesKV;
}
