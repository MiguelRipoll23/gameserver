import { decodeBase64, encodeBase64 } from "@std/encoding/base64";
import { NOTIFICATION_EVENT } from "../constants/event-constants.ts";
import {
  RATE_LIMIT_MESSAGES_PER_WINDOW,
  RATE_LIMIT_WINDOW_MILLISECONDS,
  TUNNEL_CHANNEL,
} from "../constants/websocket-constants.ts";
import { SessionKV } from "../interfaces/kv/session-kv.ts";
import { WebSocketType } from "../enums/websocket-enum.ts";
import { inject, injectable } from "@needle-di/core";
import { KVService } from "../../../../core/services/kv-service.ts";
import { WSMessageReceive } from "hono/ws";
import { WebSocketUser } from "../models/websocket-user.ts";

@injectable()
export class WebSocketService {
  private broadcastChannel: BroadcastChannel;
  private users: Map<string, WebSocketUser>;

  constructor(private kvService = inject(KVService)) {
    this.users = new Map();
    this.broadcastChannel = new BroadcastChannel(TUNNEL_CHANNEL);
    this.addBroadcastChannelListeners();
    this.addEventListeners();
  }

  public handleOpenEvent(_event: Event, user: WebSocketUser): void {
    this.handleConnection(user);
  }

  public async handleCloseEvent(
    _event: CloseEvent,
    user: WebSocketUser
  ): Promise<void> {
    await this.handleDisconnection(user);
  }

  public handleMessageEvent(
    event: MessageEvent<WSMessageReceive>,
    user: WebSocketUser
  ): void {
    if (!(event.data instanceof ArrayBuffer)) return;

    const messageTimestamps = user.getMessageTimestamps();
    const currentTime = Date.now();
    const validTimestamps = messageTimestamps.filter(
      (timestamp) => currentTime - timestamp < RATE_LIMIT_WINDOW_MILLISECONDS
    );

    if (validTimestamps.length >= RATE_LIMIT_MESSAGES_PER_WINDOW) {
      console.warn(`WebSocket rate limit exceeded for user ${user.getName()}`);
      return;
    }

    user.setMessageTimestamps([...validTimestamps, currentTime]);

    try {
      this.handleMessage(user, event.data);
    } catch (error) {
      console.error(error);
    }
  }

  private addBroadcastChannelListeners(): void {
    this.broadcastChannel.onmessage =
      this.handleBroadcastChannelMessage.bind(this);
  }

  private handleBroadcastChannelMessage(event: MessageEvent): void {
    const { destinationToken, typeId, payload } = event.data;
    const destinationUser = this.users.get(destinationToken) ?? null;

    if (destinationUser === null) {
      console.debug(
        `Token ${destinationToken} not found in this server, dropping message`
      );
      return;
    }

    this.sendMessage(destinationUser, typeId, payload);
  }

  private addEventListeners(): void {
    addEventListener(NOTIFICATION_EVENT, (event): void => {
      // deno-lint-ignore no-explicit-any
      this.sendNotificationToUsers((event as CustomEvent<any>).detail.message);
    });
  }

  private async handleConnection(webSocketUser: WebSocketUser): Promise<void> {
    const userId = webSocketUser.getId();
    const userToken = webSocketUser.getToken();

    const session: SessionKV = {
      token: userToken,
      timestamp: Date.now(),
    };

    await this.kvService.setSession(userId, session);
    this.users.set(userToken, webSocketUser);
  }

  private async handleDisconnection(user: WebSocketUser): Promise<void> {
    const userId = user.getId();
    const userName = user.getName();
    const userToken = user.getToken();

    console.log(`User ${userName} disconnected from server`);

    const result: Deno.KvCommitResult | Deno.KvCommitError =
      await this.kvService.deleteUserTemporaryData(userId);

    if (result.ok) {
      console.log(`Deleted temporary data for user ${userName}`);
      this.users.delete(userToken);
    } else {
      console.error(`Failed to delete temporary data for user ${userName}`);
      user.setWebSocket(null);
    }
  }

  private handleMessage(user: WebSocketUser, data: ArrayBuffer): void {
    console.debug("Received message from user", user.getName(), data);

    const dataView = new DataView(data);
    const typeId = dataView.getUint8(0);
    const payload = data.byteLength > 1 ? data.slice(1) : null;

    switch (typeId) {
      case WebSocketType.Tunnel: {
        return this.handleTunnelMessage(user, payload);
      }

      default:
        console.warn("Received unknown type identifier", typeId);
    }
  }

  public sendMessage(
    user: WebSocketUser,
    typeId: number,
    payload: ArrayBuffer
  ): void {
    const webSocket = user.getWebSocket();

    // If the WebSocket is null, the user is likely disconnected
    if (webSocket === null) {
      return;
    }

    const messageBuffer = new Uint8Array(1 + payload.byteLength);
    messageBuffer[0] = typeId;
    messageBuffer.set(new Uint8Array(payload), 1);

    try {
      webSocket.send(messageBuffer.buffer);
      console.debug(
        "Sent message to user",
        user.getName(),
        messageBuffer.buffer
      );
    } catch (error) {
      console.error("Failed to send message to user", user.getName(), error);
    }
  }

  private sendMessageToOtherUser(
    destinationToken: string,
    typeId: number,
    payload: ArrayBuffer
  ): void {
    const destinationUser = this.users.get(destinationToken);

    if (destinationUser) {
      this.sendMessage(destinationUser, typeId, payload);
    } else {
      this.broadcastChannel.postMessage({ destinationToken, typeId, payload });
    }
  }

  private sendNotificationToUsers(text: string): void {
    for (const user of this.users.values()) {
      const encoded = new TextEncoder().encode(text);
      const payload = encoded.slice().buffer;
      this.sendMessage(user, WebSocketType.Notification, payload);
    }
  }

  private handleTunnelMessage(
    originUser: WebSocketUser,
    payload: ArrayBuffer | null
  ): void {
    if (payload === null || payload.byteLength < 32) {
      console.warn(
        "Received tunnel message with invalid payload size, dropping..."
      );
      return;
    }

    const destinationTokenBytes = payload.slice(0, 32);
    const dataBytes = payload.slice(32);

    const combinedUserTokenData = new Uint8Array([
      ...decodeBase64(originUser.getToken()),
      ...new Uint8Array(dataBytes),
    ]);

    this.sendMessageToOtherUser(
      encodeBase64(destinationTokenBytes),
      WebSocketType.Tunnel,
      combinedUserTokenData.buffer
    );
  }
}
