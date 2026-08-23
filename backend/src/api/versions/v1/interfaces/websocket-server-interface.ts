import { WebSocketUser } from "../models/websocket-user.ts";

export interface WebSocketServer {
  sendMessage(user: WebSocketUser, payload: ArrayBuffer): void;
}
