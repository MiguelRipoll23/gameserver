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
  private users: {
    [token: string]: WebSocketUser;
  };

  constructor(private kvService = inject(KVService)) {
    this.broadcastChannel = new BroadcastChannel(TUNNEL_CHANNEL);
    this.users = {};
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
    // Check if the message is an ArrayBuffer
    if (event.data instanceof ArrayBuffer === false) {
      return;
    }

    const messageTimestamps = user.getMessageTimestamps();
    const currentTime = Date.now();

    // Filter out timestamps that are older than the rate window
    const validTimestamps = messageTimestamps.filter(
      (timestamp) => currentTime - timestamp < RATE_LIMIT_WINDOW_MILLISECONDS
    );

    // Check if rate limit has been exceeded
    if (validTimestamps.length >= RATE_LIMIT_MESSAGES_PER_WINDOW) {
      console.warn(`WebSocket rate limit exceeded for user ${user.getName()}`);
      return;
    }

    // Update the list of timestamps with the current time
    user.setMessageTimestamps([...validTimestamps, currentTime]);

    try {
      this.handleMessage(user, event.data);
    } catch (error) {
      console.error(error);
    }
  }

  private addBroadcastChannelListeners(): void {
    this.broadcastChannel.onmessage = (event: MessageEvent) => {
      const { serializedOriginUser, payload } = event.data;
      const originUser = WebSocketUser.deserialize(serializedOriginUser);

      this.handleTunnelMessage(originUser, payload, true);
    };
  }

  private addEventListeners(): void {
    // Listen for notifications to broadcast
    addEventListener(NOTIFICATION_EVENT, (event): void => {
      // https://github.com/microsoft/TypeScript/issues/28357
      // deno-lint-ignore no-explicit-any
      this.sendNotificationToUsers((event as CustomEvent<any>).detail.message);
    });
  }

  private async handleConnection(webSocketUser: WebSocketUser): Promise<void> {
    const token = webSocketUser.getToken();
    const id = webSocketUser.getId();

    // Add session for connected user
    const session: SessionKV = {
      token,
      timestamp: Date.now(),
    };

    await this.kvService.setSession(id, session);

    // Add user to the list of connected users
    this.users[token] = webSocketUser;
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
      delete this.users[userToken];
    } else {
      console.error(`Failed to delete temporary data for user ${userName}`);
      user.setWebSocket(null);
    }
  }

  private handleMessage(user: WebSocketUser, data: ArrayBuffer): void {
    console.debug("Received message from user", user.getName(), data);

    const dataView = new DataView(data);
    const id = dataView.getUint8(0);
    const payload = data.byteLength > 1 ? data.slice(1) : null;

    switch (id) {
      case WebSocketType.Tunnel: {
        return this.handleTunnelMessage(user, payload, false);
      }

      default:
        console.warn("Received unknown message identifier", id);
    }
  }

  public sendMessage(
    user: WebSocketUser,
    messageId: number,
    payload: ArrayBuffer
  ): void {
    const webSocket = user.getWebSocket();

    if (webSocket === null || webSocket.readyState !== WebSocket.OPEN) {
      return;
    }

    const arrayBuffer = new ArrayBuffer(1 + payload.byteLength);
    const dataView = new DataView(arrayBuffer);

    // Set the message ID at the start of the buffer
    dataView.setUint8(0, messageId);

    // Copy the payload into the buffer
    new Uint8Array(arrayBuffer, 1).set(new Uint8Array(payload));

    console.debug("Sent message to user", user.getName(), arrayBuffer);
    webSocket.send(arrayBuffer);
  }

  private sendNotificationToUsers(text: string) {
    for (const userId of Object.keys(this.users)) {
      const webSocketUser: WebSocketUser = this.users[userId];
      const encoded = new TextEncoder().encode(text);
      const payload = encoded.slice().buffer;
      this.sendMessage(webSocketUser, WebSocketType.Notification, payload);
    }
  }

  private handleTunnelMessage(
    originUser: WebSocketUser,
    payload: ArrayBuffer | null,
    broadcasted: boolean
  ): void {
    if (payload === null) {
      console.warn("Received empty tunnel message, dropping...");
      return;
    }

    if (payload.byteLength < 32) {
      console.warn(
        "Received tunnel message with invalid payload size, dropping..."
      );
      return;
    }

    const destinationTokenBytes = payload.slice(0, 32);
    const webrtcDataBytes = payload.slice(32);

    const destinationToken = encodeBase64(destinationTokenBytes);
    const destinationUser = this.users[destinationToken];

    if (destinationToken in this.users === false) {
      this.handleUserNotFound(
        originUser,
        destinationToken,
        payload,
        broadcasted
      );
      return;
    }

    const originTokenBytes = decodeBase64(originUser.getToken());
    const tunnelPayload = new Uint8Array([
      ...originTokenBytes,
      ...new Uint8Array(webrtcDataBytes),
    ]);

    console.log(
      `Routing tunnel message from user ${originUser.getName()} to ${destinationUser.getName()}`
    );

    this.sendMessage(
      destinationUser,
      WebSocketType.Tunnel,
      tunnelPayload.buffer
    );
  }

  private handleUserNotFound(
    originUser: WebSocketUser,
    destinationToken: string,
    payload: ArrayBuffer,
    broadcasted: boolean
  ): void {
    if (broadcasted) {
      console.debug(`User ${destinationToken} not found, message dropped`);
    } else {
      console.debug(
        `User ${destinationToken} not found, broadcasting tunnel message...`
      );

      const serializedOriginUser = originUser.serialize();
      this.broadcastChannel.postMessage({ serializedOriginUser, payload });
    }
  }
}
