import { WebSocketType } from "../enums/websocket-enum.ts";

export interface CommandHandlerMetadata {
  commandId: WebSocketType;
  methodName: string;
  target: object;
}
