import { WebSocketUser } from "../models/websocket-user.ts";

export interface WebSocketServer {
  getUserById(id: string): WebSocketUser | undefined;
  getUserBySessionId(sessionId: string): WebSocketUser | undefined;
  sendMessage(user: WebSocketUser, payload: ArrayBuffer): void;
}
