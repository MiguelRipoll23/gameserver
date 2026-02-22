import { BinaryWriter } from "../../../../core/utils/binary-writer-utils.ts";
import { WebSocketType } from "../enums/websocket-enum.ts";
import type { NotificationChannelType } from "../enums/notification-channel-enum.ts";

export function buildNotificationPayload(
  channelId: NotificationChannelType,
  text: string,
): ArrayBuffer {
  const textBytes = new TextEncoder().encode(text);

  return BinaryWriter.build()
    .unsignedInt8(WebSocketType.Notification)
    .unsignedInt8(channelId)
    .bytes(textBytes)
    .toArrayBuffer();
}

export function buildAuthenticationAckPayload(success: boolean): ArrayBuffer {
  return BinaryWriter.build()
    .unsignedInt8(WebSocketType.Authentication)
    .unsignedInt8(success ? 1 : 0)
    .toArrayBuffer();
}

export function buildPlayerIdentityPayload(
  originTokenBytes: Uint8Array,
  networkId: string,
  name: string,
): ArrayBuffer {
  return BinaryWriter.build()
    .unsignedInt8(WebSocketType.PlayerIdentity)
    .bytes(originTokenBytes, 32)
    .fixedLengthString(networkId, 32)
    .fixedLengthString(name, 16)
    .toArrayBuffer();
}

export function buildTunnelPayload(
  originTokenBytes: Uint8Array,
  dataBytes: Uint8Array,
): ArrayBuffer {
  return BinaryWriter.build()
    .unsignedInt8(WebSocketType.Tunnel)
    .bytes(originTokenBytes, 32)
    .bytes(dataBytes)
    .toArrayBuffer();
}

export function buildUserBanPayload(bannedUserNetworkId: string): ArrayBuffer {
  return BinaryWriter.build()
    .unsignedInt8(WebSocketType.UserBan)
    .fixedLengthString(bannedUserNetworkId, 32)
    .toArrayBuffer();
}

export function buildOnlinePlayersPayload(totalSessions: number): ArrayBuffer {
  return BinaryWriter.build()
    .unsignedInt8(WebSocketType.OnlinePlayers)
    .unsignedInt16(totalSessions)
    .toArrayBuffer();
}

export default {
  buildNotificationPayload,
  buildAuthenticationAckPayload,
  buildPlayerIdentityPayload,
  buildTunnelPayload,
  buildUserBanPayload,
  buildOnlinePlayersPayload,
};
