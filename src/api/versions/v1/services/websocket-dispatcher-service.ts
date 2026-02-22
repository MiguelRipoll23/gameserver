import { BinaryReader } from "../../../../core/utils/binary-reader-utils.ts";
import { getCommandHandlers } from "../decorators/command-handler.ts";
import { WebSocketType } from "../enums/websocket-enum.ts";
import { WebSocketUser } from "../models/websocket-user.ts";
import { CommandHandlerFunction } from "../types/command-handler-function-type.ts";
import { injectable } from "@needle-di/core";

@injectable()
export class WebSocketDispatcherService {
  private commandHandlers = new Map<WebSocketType, CommandHandlerFunction>();

  public registerCommandHandlers(instance: unknown): void {
    const proto = Object.getPrototypeOf(instance as object);
    const commandHandlers = getCommandHandlers().filter(
      (commandHandler) => commandHandler.target === proto,
    );

    for (const { commandId, methodName } of commandHandlers) {
      const inst = instance as Record<string, unknown>;
      const maybe = inst[methodName];

      if (typeof maybe !== "function") {
        console.error(
          `Method "${methodName}" not found or is not a function on the instance.`,
        );
        continue;
      }

      const boundMethod = (maybe as CommandHandlerFunction).bind(
        instance as object,
      ) as CommandHandlerFunction;
      this.bindCommandHandler(commandId, boundMethod);
    }
  }

  public dispatchCommand(
    user: WebSocketUser,
    commandId: WebSocketType,
    binaryReader: BinaryReader,
  ): void {
    const commandHandler = this.commandHandlers.get(commandId);

    if (commandHandler === undefined) {
      console.warn(`No command handler found for ${WebSocketType[commandId]}`);
      return;
    }

    try {
      commandHandler(user, binaryReader);
    } catch (error) {
      console.error(
        `Error executing command handler for ${WebSocketType[commandId]}:`,
        error,
      );
    }
  }

  private bindCommandHandler(
    commandId: WebSocketType,
    commandHandler: CommandHandlerFunction,
  ): void {
    this.commandHandlers.set(commandId, commandHandler);
    console.log(`Command handler bound for ${WebSocketType[commandId]}`);
  }
}
