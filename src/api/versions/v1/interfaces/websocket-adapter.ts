export interface WebSocketAdapter {
  getUserById(id: string): import('../models/websocket-user.ts').WebSocketUser | undefined;
  getUserByToken(token: string): import('../models/websocket-user.ts').WebSocketUser | undefined;
  sendMessage(user: import('../models/websocket-user.ts').WebSocketUser, payload: ArrayBuffer): void;
}
