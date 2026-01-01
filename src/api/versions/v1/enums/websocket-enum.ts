export enum WebSocketType {
  Notification = 0,
  PlayerIdentity = 1,
  Tunnel = 2,
  OnlinePlayers = 3,
  ChatMessage = 4,
  UserBan = 7, // Value 7 as specified in the protocol specification
}
