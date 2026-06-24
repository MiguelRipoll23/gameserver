import { BroadcastEnvelopeSchema } from "../api/versions/v1/schemas/broadcast-envelope-schema.ts";

interface DispatchRequest {
  command: number;
  payload: unknown;
  originInstanceId: string;
}

export class GameServerDO implements DurableObject {
  private sessions: WebSocket[] = [];
  private instanceIds = new Map<WebSocket, string>();

  constructor(_ctx: DurableObjectState, _env: unknown) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/connect") {
      const instanceId = url.searchParams.get("instanceId");
      if (!instanceId) {
        return new Response("instanceId query parameter required", { status: 400 });
      }
      const pair = new WebSocketPair();
      const server = pair[1];

      this.sessions.push(server);
      this.instanceIds.set(server, instanceId);

      server.accept();
      server.addEventListener("close", () => {
        this.sessions = this.sessions.filter((s) => s !== server);
        this.instanceIds.delete(server);
      });
      server.addEventListener("error", () => {
        this.sessions = this.sessions.filter((s) => s !== server);
        this.instanceIds.delete(server);
      });

      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    if (url.pathname === "/dispatch") {
      if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }

      let event: DispatchRequest;
      try {
        event = await request.json() as DispatchRequest;
      } catch {
        return new Response("Invalid JSON body", { status: 400 });
      }
      const parsed = BroadcastEnvelopeSchema.safeParse({
        command: event.command,
        payload: event.payload,
        originInstanceId: event.originInstanceId,
      });

      if (!parsed.success) {
        return new Response("Invalid event format", { status: 400 });
      }

      for (const ws of this.sessions) {
        const sid = this.instanceIds.get(ws);
        if (sid !== event.originInstanceId) {
          try {
            ws.send(JSON.stringify(parsed.data));
          } catch {
            this.sessions = this.sessions.filter((s) => s !== ws);
            this.instanceIds.delete(ws);
          }
        }
      }

      return new Response("OK");
    }

    return new Response("Not found", { status: 404 });
  }
}
