import { SHARED_BROADCAST_CHANNEL } from "../constants/broadcast-channel-constants.ts";
import { injectable } from "@needle-di/core";
import { BroadcastCommandType } from "../enums/broadcast-command-enum.ts";
import { BroadcastCommandPayloadMap } from "../types/broadcast-command-payload-map-type.ts";

type BroadcastEnvelope<T extends BroadcastCommandType> = {
  command: T;
  payload: BroadcastCommandPayloadMap[T];
  originInstanceId: string;
};

type BroadcastHandler<T extends BroadcastCommandType> = (
  payload: BroadcastCommandPayloadMap[T],
) => void;

@injectable()
export class WebSocketBroadcastService {
  private broadcastChannel: BroadcastChannel;
  private readonly instanceId = crypto.randomUUID();
  private handlers: {
    [T in BroadcastCommandType]: Set<BroadcastHandler<T>>;
  } = {
    [BroadcastCommandType.OnlineUsersCount]: new Set(),
    [BroadcastCommandType.TunnelMessage]: new Set(),
    [BroadcastCommandType.UserNotification]: new Set(),
    [BroadcastCommandType.KickUser]: new Set(),
    [BroadcastCommandType.UserKickedNotification]: new Set(),
    [BroadcastCommandType.RefreshBlockedWordsCache]: new Set(),
  };

  constructor() {
    this.broadcastChannel = new BroadcastChannel(SHARED_BROADCAST_CHANNEL);
    this.broadcastChannel.addEventListener(
      "message",
      this.handleIncomingMessage.bind(this),
    );
  }

  public close(): void {
    this.broadcastChannel.close();
  }

  public on<T extends BroadcastCommandType>(
    command: T,
    cb: BroadcastHandler<T>,
  ): void {
    this.handlers[command].add(cb);
  }

  public dispatch<T extends BroadcastCommandType>(
    command: T,
    payload: BroadcastCommandPayloadMap[T],
  ): void {
    const message: BroadcastEnvelope<T> = {
      command,
      payload,
      originInstanceId: this.instanceId,
    };

    this.broadcastChannel.postMessage(message);
    console.log(`Broadcasted command ${command} from instance ${this.instanceId}`);
  }

  private handleIncomingMessage(event: MessageEvent): void {
    const message = this.parseMessageContract(event.data);

    if (!message) {
      console.warn("Ignored malformed broadcast message", event.data);
      return;
    }

    if (message.originInstanceId === this.instanceId) {
      return;
    }

    this.dispatchIncomingCommand(message);
  }

  private parseMessageContract(
    message: unknown,
  ): BroadcastEnvelope<BroadcastCommandType> | null {
    if (typeof message !== "object" || message === null) {
      return null;
    }

    if (!("command" in message) || !("originInstanceId" in message)) {
      return null;
    }

    const command = message.command;
    const originInstanceId = message.originInstanceId;
    const payload = "payload" in message ? message.payload : null;

    if (!this.isSupportedCommand(command)) {
      console.warn(`Received unsupported broadcast command: ${String(command)}`);
      return null;
    }

    if (typeof originInstanceId !== "string") {
      return null;
    }

    if (!this.isValidPayload(command, payload)) {
      return null;
    }

    return {
      command,
      payload,
      originInstanceId,
    };
  }

  private dispatchIncomingCommand(
    message: BroadcastEnvelope<BroadcastCommandType>,
  ): void {
    switch (message.command) {
      case BroadcastCommandType.OnlineUsersCount:
      case BroadcastCommandType.TunnelMessage:
      case BroadcastCommandType.UserNotification:
      case BroadcastCommandType.KickUser:
      case BroadcastCommandType.UserKickedNotification:
      case BroadcastCommandType.RefreshBlockedWordsCache:
        this.notifyHandlers(message.command, message.payload);
        return;
      default:
        this.assertNever(message.command);
    }
  }

  private notifyHandlers<T extends BroadcastCommandType>(
    command: T,
    payload: BroadcastCommandPayloadMap[T],
  ): void {
    for (const handler of this.handlers[command]) {
      try {
        handler(payload);
      } catch (err) {
        if (this.logger && typeof this.logger.error === "function") {
          this.logger.error(`Handler error for command ${command}:`, err);
        } else {
          console.error(`Handler error for command ${command}:`, err);
        }
      }
    }
  }

  private isSupportedCommand(command: unknown): command is BroadcastCommandType {
    return Object.values(BroadcastCommandType).includes(
      command as BroadcastCommandType,
    );
  }

  private isValidPayload<T extends BroadcastCommandType>(
    command: T,
    payload: unknown,
  ): payload is BroadcastCommandPayloadMap[T] {
    switch (command) {
      case BroadcastCommandType.OnlineUsersCount:
        return this.isObject(payload) && payload.payload instanceof ArrayBuffer;
      case BroadcastCommandType.TunnelMessage:
        return this.isObject(payload) &&
          typeof payload.destinationToken === "string" &&
          payload.payload instanceof ArrayBuffer;
      case BroadcastCommandType.UserNotification:
        return this.isObject(payload) &&
          typeof payload.userId === "string" &&
          typeof payload.message === "string" &&
          Object.values(NotificationChannelType).includes(payload.channelId);
      case BroadcastCommandType.KickUser:
        return this.isObject(payload) && typeof payload.userId === "string";
      case BroadcastCommandType.UserKickedNotification:
        return this.isObject(payload) &&
          typeof payload.hostUserId === "string" &&
          typeof payload.bannedUserNetworkId === "string";
      case BroadcastCommandType.RefreshBlockedWordsCache:
        return payload === null;
      default:
        this.assertNever(command);
    }
  }

  private isObject(
    value: unknown,
  ): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }

  private assertNever(value: never): never {
    throw new Error(`Unhandled broadcast command: ${String(value)}`);
  }
}

export default WebSocketBroadcastService;
