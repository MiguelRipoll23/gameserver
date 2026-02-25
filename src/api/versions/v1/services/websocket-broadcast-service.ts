import { SHARED_BROADCAST_CHANNEL } from "../constants/broadcast-channel-constants.ts";
import { injectable } from "@needle-di/core";
import { BroadcastCommandType } from "../enums/broadcast-command-enum.ts";
import { BroadcastCommandPayloadMap } from "../types/broadcast-command-payload-map-type.ts";
import { BroadcastEnvelope } from "../types/broadcast-envelope-type.ts";
import type { BroadcastHandler } from "../interfaces/broadcast-handler-interface.ts";
import { z } from "zod";
import { BroadcastEnvelopeSchema } from "../schemas/broadcast-envelope-schema.ts";

@injectable()
export class WebSocketBroadcastService {
  private broadcastChannel: BroadcastChannel;
  private readonly instanceId = crypto.randomUUID();
  private handlers = new Map<
    BroadcastCommandType,
    Set<BroadcastHandler<any>>
  >();

  constructor() {
    this.broadcastChannel = new BroadcastChannel(SHARED_BROADCAST_CHANNEL);
    this.broadcastChannel.addEventListener(
      "message",
      this.handleIncomingMessage,
    );
  }

  public close(): void {
    this.broadcastChannel.close();
  }

  public on<T extends BroadcastCommandType>(
    command: T,
    cb: BroadcastHandler<T>,
  ): () => void {
    let set = this.handlers.get(command) as
      | Set<BroadcastHandler<T>>
      | undefined;
    if (!set) {
      set = new Set<BroadcastHandler<T>>();
      this.handlers.set(command, set as unknown as Set<BroadcastHandler<any>>);
    }

    set.add(cb);
    return () => this.off(command, cb);
  }

  public off<T extends BroadcastCommandType>(
    command: T,
    cb: BroadcastHandler<T>,
  ): void {
    this.handlers.get(command)?.delete(cb);
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
    console.debug(
      `Broadcasted command ${command} from instance ${this.instanceId}`,
    );
  }
  private handleIncomingMessage = (event: MessageEvent): void => {
    let message: z.infer<typeof BroadcastEnvelopeSchema>;
    try {
      message = BroadcastEnvelopeSchema.parse(event.data);
    } catch (error) {
      console.warn("Ignored malformed broadcast message", event.data, error);
      return;
    }

    if (message.originInstanceId === this.instanceId) return;

    this.notifyHandlers(message.command, message.payload as any);
  };

  private executeHandler<T extends BroadcastCommandType>(
    handler: BroadcastHandler<T>,
    command: T,
    payload: BroadcastCommandPayloadMap[T],
  ): void {
    try {
      Promise.resolve(handler(payload)).catch((error) => {
        console.error(`Handler error for command ${command}:`, error);
      });
    } catch (error) {
      console.error(`Handler error for command ${command}:`, error);
    }
  }

  private notifyHandlers<T extends BroadcastCommandType>(
    command: T,
    payload: BroadcastCommandPayloadMap[T],
  ): void {
    const handlersSet = this.handlers.get(command) as
      | Set<BroadcastHandler<T>>
      | undefined;

    if (!handlersSet) {
      console.warn(`No handlers registered for command ${command}`);
      return;
    }

    // Use a snapshot so handlers may remove themselves while iterating
    const handlers = Array.from(handlersSet);

    for (const handler of handlers) {
      this.executeHandler(handler, command, payload);
    }
  }
}

export default WebSocketBroadcastService;
