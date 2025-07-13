import { BinaryReader } from "../../../../core/utils/binary-reader-utils.ts";
import { getCommandHandlers } from "../decorators/command-handler.ts";
import { WebSocketType } from "../enums/websocket-enum.ts";
import { CommandHandlerFunction } from "../types/command-handler-function-type.ts";

export class WebSocketDispatcherService {
  private commandHandlers = new Map<WebSocketType, CommandHandlerFunction>();

  public registerCommandHandlers(instance: any): void {
    const commandHandlers = getCommandHandlers().filter(
      (commandHandler) =>
        commandHandler.target === Object.getPrototypeOf(instance)
    );

    for (const { commandId, methodName } of commandHandlers) {
      const method = instance[methodName];

      if (typeof method !== "function") {
        console.error(
          `Method "${methodName}" not found or is not a function on the instance.`
        );
        continue;
      }

      const boundMethod = instance[methodName].bind(instance);
      this.bindCommandHandler(commandId, boundMethod);
    }
  }

  public dispatchCommand(
    commandId: WebSocketType,
    binaryReader: BinaryReader
  ): void {
    const commandHandler = this.commandHandlers.get(commandId);

    if (commandHandler === undefined) {
      console.warn(`No command handler found for ${WebSocketType[commandId]}`);
      return;
    }

    try {
      commandHandler(binaryReader);
    } catch (error) {
      console.error(
        `Error executing command handler for ${WebSocketType[commandId]}:`,
        error
      );
    }
  }

  private bindCommandHandler(
    commandId: WebSocketType,
    commandHandler: CommandHandlerFunction
  ): void {
    this.commandHandlers.set(commandId, commandHandler);
    console.log(`Command handler bound for ${WebSocketType[commandId]}`);
  }
}
