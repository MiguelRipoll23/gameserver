import { BroadcastCommandType } from "../enums/broadcast-command-enum.ts";
import { EventHandlerMetadata } from "../interfaces/event-handler-metadata-interface.ts";

const eventHandlers: EventHandlerMetadata[] = [];

export function EventHandler(command: BroadcastCommandType) {
  return function (
    target: object,
    propertyKey: string,
    propertyDescriptor: PropertyDescriptor,
  ) {
    if (typeof propertyDescriptor.value !== "function") {
      throw new Error(`@EventHandler can only be applied to methods`);
    }

    if (hasEventHandler(target, propertyKey, command)) {
      console.warn(
        `Duplicate @EventHandler registration for ${propertyKey} with command ${command}`,
      );
      return;
    }

    eventHandlers.push({
      command,
      methodName: propertyKey,
      target,
    });
  };
}

export function getEventHandlers(): EventHandlerMetadata[] {
  return eventHandlers;
}

export function hasEventHandler(
  target: object,
  methodName: string,
  command: BroadcastCommandType,
): boolean {
  return eventHandlers.some(
    (handler) =>
      handler.target === target &&
      handler.methodName === methodName &&
      handler.command === command,
  );
}


export function clearEventHandlers(): void {
  eventHandlers.length = 0;
}
