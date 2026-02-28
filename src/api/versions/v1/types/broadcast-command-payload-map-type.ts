import { OnlinePlayersPayload } from "./online-players-payload-type.ts";
import { PlayerIdentityPayload } from "./player-identity-payload-type.ts";
import { PlayerRelayPayload } from "./player-relay-payload-type.ts";
import { NotificationPayload } from "./notification-payload-type.ts";
import { PlayerNotificationPayload } from "./player-notification-payload-type.ts";
import { KickPlayerPayload } from "./kick-player-payload-type.ts";
import { PlayerKickedNotificationPayload } from "./player-kicked-notification-payload-type.ts";

export type BroadcastCommandPayloadMap = {
  OnlinePlayers: OnlinePlayersPayload;
  PlayerIdentity: PlayerIdentityPayload;
  PlayerRelay: PlayerRelayPayload;
  Notification: NotificationPayload;
  PlayerNotification: PlayerNotificationPayload;
  KickPlayer: KickPlayerPayload;
  PlayerKickedNotification: PlayerKickedNotificationPayload;
  RefreshBlockedWordsCache: null;
};
