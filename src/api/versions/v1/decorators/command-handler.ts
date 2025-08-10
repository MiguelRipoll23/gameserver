import { WebSocketType } from "../enums/websocket-enum.ts";
import { CommandHandlerMetadata } from "../interfaces/command-handler-metadata-interface.ts";

const commandHandlers: CommandHandlerMetadata[] = [];

export function CommandHandler(commandId: WebSocketType) {
  return function (
    target: object,
    propertyKey: string,
    propertyDescriptor: PropertyDescriptor
  ) {
    // Validate method signature if possible
    if (typeof propertyDescriptor.value !== "function") {
      throw new Error(`@CommandHandler can only be applied to methods`);
    }

    // Prevent duplicate registrations
    if (hasCommandHandler(target, propertyKey, commandId)) {
      console.warn(
        `Duplicate @CommandHandler registration for ${propertyKey} with command ${commandId}`
      );
      return;
    }

    commandHandlers.push({
      commandId: commandId,
      methodName: propertyKey,
      target,
    });
  };
}

export function getCommandHandlers(): CommandHandlerMetadata[] {
  return commandHandlers;
}

export function clearCommandHandlers(): void {
  commandHandlers.length = 0;
}

export function hasCommandHandler(
  target: object,
  methodName: string,
  commandId: WebSocketType
): boolean {
  return commandHandlers.some(
    (h) =>
      h.target === target &&
      h.methodName === methodName &&
      h.commandId === commandId
  );
}
