import { BroadcastCommandType } from "../enums/broadcast-command-enum.ts";
import { BroadcastCommandPayloadMap } from "../types/broadcast-command-payload-map-type.ts";

export type BroadcastEnvelope<
  T extends BroadcastCommandType = BroadcastCommandType,
> = {
  command: T;
  payload: BroadcastCommandPayloadMap[T];
  originInstanceId: string;
};
