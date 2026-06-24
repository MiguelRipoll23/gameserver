import { inject, injectable } from "@needle-di/core";
import { EnvService } from "../../../../core/services/env-service.ts";
import { EventDispatchMode } from "../constants/event-constants.ts";
import { getEventHandlers } from "../decorators/event-handler.ts";
import { BroadcastCommandType } from "../enums/broadcast-command-enum.ts";
import { BroadcastEnvelopeSchema } from "../schemas/broadcast-envelope-schema.ts";
import { EventHandlerFunction } from "../types/event-handler-function-type.ts";
import { z } from "zod";

@injectable()
export class EventsService {
  private static readonly DO_ID_NAME = "events-hub";

  private readonly instanceId = crypto.randomUUID();
  private doWebSocket: WebSocket | null = null;
  private connecting = false;
  private doReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectRetryCount = 0;
  private readonly handlers = new Map<
    BroadcastCommandType,
    Set<EventHandlerFunction>
  >();
  private readonly registeredHandlersByInstance = new WeakMap<
    object,
    Set<string>
  >();

  constructor(private envService = inject(EnvService)) {}

  public async init(): Promise<void> {
    await this.connectToDO();
  }

  public close(): void {
    if (this.doReconnectTimer !== null) {
      clearTimeout(this.doReconnectTimer);
      this.doReconnectTimer = null;
    }
    if (this.doWebSocket !== null) {
      this.doWebSocket.close();
      this.doWebSocket = null;
    }
  }

  public registerEventHandlers(instance: unknown): void {
    const instanceObject = instance as object;
    const proto = Object.getPrototypeOf(instanceObject);
    const eventHandlers = getEventHandlers().filter(
      (handler) => handler.target === proto,
    );

    let registeredHandlers =
      this.registeredHandlersByInstance.get(instanceObject);
    if (!registeredHandlers) {
      registeredHandlers = new Set<string>();
      this.registeredHandlersByInstance.set(instanceObject, registeredHandlers);
    }

    for (const { command, methodName } of eventHandlers) {
      const registrationKey = `${command}:${methodName}`;

      if (registeredHandlers.has(registrationKey)) {
        continue;
      }

      const inst = instance as Record<string, unknown>;
      const maybe = inst[methodName];

      if (typeof maybe !== "function") {
        console.error(
          `Method "${methodName}" not found or is not a function on the instance.`,
        );
        continue;
      }

      const boundMethod = (maybe as EventHandlerFunction).bind(
        instanceObject,
      ) as EventHandlerFunction;
      this.bindEventHandler(command, boundMethod);
      registeredHandlers.add(registrationKey);
    }
  }

  public dispatch(
    command: BroadcastCommandType,
    payload: unknown,
    mode: EventDispatchMode = EventDispatchMode.LocalOrBroadcast,
  ): void {
    const handledLocally = this.notifyHandlers(command, payload);

    if (mode === EventDispatchMode.LocalOrBroadcast && handledLocally) {
      return;
    }

    this.postToDO({ command, payload, originInstanceId: this.instanceId });
  }

  private async connectToDO(): Promise<void> {
    if (this.connecting) return;
    this.connecting = true;
    try {
      const ns = this.envService.getDurableObjectNamespace();
      const id = ns.idFromName(EventsService.DO_ID_NAME);
      const stub = ns.get(id);

      const url = `http://do/connect?instanceId=${this.instanceId}`;
      const response = await stub.fetch(url);
      // WebSocket upgrade response
      if (response.status === 101) {
        this.doWebSocket = (response as unknown as { webSocket: WebSocket }).webSocket;
        this.doWebSocket.accept();
        this.doWebSocket.addEventListener("message", (event: MessageEvent) => {
          this.handleIncomingMessage(event);
        });
        this.doWebSocket.addEventListener("close", () => {
          this.doWebSocket = null;
          this.scheduleReconnect();
        });
        this.doWebSocket.addEventListener("error", () => {
          this.doWebSocket = null;
          this.scheduleReconnect();
        });
        this.onReconnectSuccess();
      }
    } catch (error) {
      console.error("Failed to connect to Durable Object:", error);
      this.scheduleReconnect();
    } finally {
      this.connecting = false;
    }
  }

  private scheduleReconnect(): void {
    if (this.doReconnectTimer !== null) return;
    const delay = Math.min(5000 * Math.pow(2, this.reconnectRetryCount), 60000);
    this.reconnectRetryCount++;
    this.doReconnectTimer = setTimeout(() => {
      this.doReconnectTimer = null;
      void this.connectToDO();
    }, delay);
  }

  private onReconnectSuccess(): void {
    this.reconnectRetryCount = 0;
  }

  private async postToDO(payload: {
    command: BroadcastCommandType;
    payload: unknown;
    originInstanceId: string;
  }): Promise<void> {
    try {
      const ns = this.envService.getDurableObjectNamespace();
      const id = ns.idFromName(EventsService.DO_ID_NAME);
      const stub = ns.get(id);

      await stub.fetch("http://do/dispatch", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      console.debug(
        `Broadcasted command ${payload.command} from instance ${this.instanceId}`,
      );
    } catch (error) {
      console.error("Failed to dispatch event to Durable Object:", error);
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
      message = BroadcastEnvelopeSchema.parse(JSON.parse(event.data as string));
    } catch (error) {
      console.warn("Ignored malformed broadcast message", event.data, error);
      return;
    }

    if (message.originInstanceId === this.instanceId) {
      return;
    }

    console.debug(
      `Received broadcasted command ${message.command} on instance ${this.instanceId}`,
    );

    this.notifyHandlers(message.command, message.payload);
  };

  private notifyHandlers(
    command: BroadcastCommandType,
    payload: unknown,
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

  private executeHandler(
    handler: EventHandlerFunction,
    command: BroadcastCommandType,
    payload: unknown,
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

        return true;
      }

      return result;
    } catch (error) {
      console.error(`Event handler error for command ${command}:`, error);
      return false;
    }
  }
}
