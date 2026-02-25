import { BroadcastCommandType } from "../enums/broadcast-command-enum.ts";
import { BroadcastCommandPayloadMap } from "../types/broadcast-command-payload-map-type.ts";

export type BroadcastHandler<
  T extends BroadcastCommandType = BroadcastCommandType,
> = (payload: BroadcastCommandPayloadMap[T]) => void | Promise<void>;
