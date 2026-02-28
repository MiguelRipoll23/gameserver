import { BroadcastCommandType } from "../enums/broadcast-command-enum.ts";

export interface EventHandlerMetadata {
  command: BroadcastCommandType;
  methodName: string;
  target: object;
}
