import { injectable } from "@needle-di/core";
import { SHARED_BROADCAST_CHANNEL } from "../constants/broadcast-channel-constants.ts";
import {
  EVENT_DISPATCH_MODE_LOCAL_AND_BROADCAST,
  EVENT_DISPATCH_MODE_LOCAL_OR_BROADCAST,
} from "../constants/event-constants.ts";
import { getEventHandlers } from "../decorators/event-handler.ts";
import { BroadcastCommandType } from "../enums/broadcast-command-enum.ts";
import { BroadcastEnvelopeSchema } from "../schemas/broadcast-envelope-schema.ts";
import { BroadcastCommandPayloadMap } from "../types/broadcast-command-payload-map-type.ts";
import { EventHandlerFunction } from "../types/event-handler-function-type.ts";
import { z } from "zod";

export type EventDispatchMode =
  | typeof EVENT_DISPATCH_MODE_LOCAL_OR_BROADCAST
  | typeof EVENT_DISPATCH_MODE_LOCAL_AND_BROADCAST;

@injectable()
export class EventsService {
  private readonly broadcastChannel = new BroadcastChannel(
    SHARED_BROADCAST_CHANNEL,
  );
  private readonly instanceId = crypto.randomUUID();
  private readonly handlers = new Map<
    BroadcastCommandType,
    Set<EventHandlerFunction>
  >();

  constructor() {
    this.broadcastChannel.addEventListener("message", this.handleIncomingMessage);
  }

  public close(): void {
    this.broadcastChannel.close();
  }

  public registerEventHandlers(instance: unknown): void {
    const proto = Object.getPrototypeOf(instance as object);
    const eventHandlers = getEventHandlers().filter((handler) =>
      handler.target === proto
    );

    for (const { command, methodName } of eventHandlers) {
      const inst = instance as Record<string, unknown>;
      const maybe = inst[methodName];

      if (typeof maybe !== "function") {
        console.error(
          `Method "${methodName}" not found or is not a function on the instance.`,
        );
        continue;
      }

      const boundMethod = (maybe as EventHandlerFunction).bind(
        instance as object,
      ) as EventHandlerFunction;
      this.bindEventHandler(command, boundMethod);
    }
  }

  public dispatch<T extends BroadcastCommandType>(
    command: T,
    payload: BroadcastCommandPayloadMap[T],
    mode: EventDispatchMode = EVENT_DISPATCH_MODE_LOCAL_OR_BROADCAST,
  ): void {
    const handledLocally = this.notifyHandlers(command, payload);

    if (mode === EVENT_DISPATCH_MODE_LOCAL_AND_BROADCAST || !handledLocally) {
      this.broadcastChannel.postMessage({
        command,
        payload,
        originInstanceId: this.instanceId,
      });
      console.debug(
        `Broadcasted command ${command} from instance ${this.instanceId}`,
      );
    }
  }

  private bindEventHandler(
    command: BroadcastCommandType,
    handler: EventHandlerFunction,
  ): void {
    let set = this.handlers.get(command);

    if (!set) {
      set = new Set<EventHandlerFunction>();
      this.handlers.set(command, set);
    }

    set.add(handler);
  }

  private handleIncomingMessage = (event: MessageEvent): void => {
    let message: z.infer<typeof BroadcastEnvelopeSchema>;

    try {
      message = BroadcastEnvelopeSchema.parse(event.data);
    } catch (error) {
      console.warn("Ignored malformed broadcast message", event.data, error);
      return;
    }

    if (message.originInstanceId === this.instanceId) {
      return;
    }

    this.notifyHandlers(message.command, message.payload as never);
  };

  private notifyHandlers<T extends BroadcastCommandType>(
    command: T,
    payload: BroadcastCommandPayloadMap[T],
  ): boolean {
    const handlersSet = this.handlers.get(command);

    if (!handlersSet || handlersSet.size === 0) {
      return false;
    }

    const handlers = Array.from(handlersSet);
    let handled = false;

    for (const handler of handlers) {
      handled = this.executeHandler(handler, command, payload) || handled;
    }

    return handled;
  }

  private executeHandler<T extends BroadcastCommandType>(
    handler: EventHandlerFunction,
    command: T,
    payload: BroadcastCommandPayloadMap[T],
  ): boolean {
    try {
      const result = handler(payload);

      if (result instanceof Promise) {
        result
          .then((resolved) => {
            if (resolved === false) {
              console.debug(
                `Async event handler for command ${command} resolved as not handled`,
              );
            }
          })
          .catch((error) => {
            console.error(`Event handler error for command ${command}:`, error);
          });

        // Synchronous dispatch cannot await async completion. Consider it handled to avoid duplicate broadcasts.
        return true;
      }

      return result;
    } catch (error) {
      console.error(`Event handler error for command ${command}:`, error);
      return false;
    }
  }
}
