import { WebSocketUser } from "../models/websocket-user.ts";

export interface IWebSocketService {
  getUserById(id: string): WebSocketUser | undefined;
  getUserBySessionId(sessionId: string): WebSocketUser | undefined;
  sendMessage(user: WebSocketUser, payload: ArrayBuffer): void;
}
