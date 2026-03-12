import { BinaryWriter } from "../../../../core/utils/binary-writer-utils.ts";
import { WebSocketType } from "../enums/websocket-enum.ts";
import type { NotificationChannelType } from "../enums/notification-channel-enum.ts";

export function buildAuthenticationResponsePayload(
  userSignature: ArrayBuffer,
): ArrayBuffer {
  return BinaryWriter.build()
    .unsignedInt8(WebSocketType.Authentication)
    .unsignedInt8(0)
    .arrayBuffer(userSignature)
    .toArrayBuffer();
}

export function buildOnlinePlayersPayload(totalSessions: number): ArrayBuffer {
  const clampedSessions = Math.max(0, Math.min(65535, totalSessions));
  return BinaryWriter.build()
    .unsignedInt8(WebSocketType.OnlinePlayers)
    .unsignedInt16(clampedSessions)
    .toArrayBuffer();
}

export function buildPlayerRelayPayload(
  originTokenBytes: Uint8Array,
  dataBytes: Uint8Array,
): ArrayBuffer {
  return BinaryWriter.build()
    .unsignedInt8(WebSocketType.PlayerRelay)
    .bytes(originTokenBytes, 32)
    .bytes(dataBytes)
    .toArrayBuffer();
}

export function buildPlayerKickedPayload(
  bannedUserNetworkId: string,
): ArrayBuffer {
  return BinaryWriter.build()
    .unsignedInt8(WebSocketType.PlayerKicked)
    .fixedLengthString(bannedUserNetworkId, 32)
    .toArrayBuffer();
}

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

export default {
  buildNotificationPayload,
  buildAuthenticationResponsePayload,
  buildPlayerRelayPayload,
  buildPlayerKickedPayload,
  buildOnlinePlayersPayload,
};
