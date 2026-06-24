import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { inject, injectable } from "@needle-di/core";
import { upgradeWebSocket } from "hono/cloudflare-workers";
import { getConnInfo } from "hono/cloudflare-workers";
import type { Context } from "hono";
import type { WSContext } from "hono/ws";
import { WebSocketService } from "../../services/websocket-service.ts";
import { HonoVariables } from "../../../../../core/types/hono-variables-type.ts";
import { ServerResponse } from "../../models/server-response.ts";
import { WebSocketUser } from "../../models/websocket-user.ts";

@injectable()
export class AuthenticatedWebSocketRouter {
  private app: OpenAPIHono<{ Variables: HonoVariables }>;

  constructor(private webSocketService = inject(WebSocketService)) {
    this.app = new OpenAPIHono();
    this.setRoutes();
  }

  public getRouter(): OpenAPIHono<{ Variables: HonoVariables }> {
    return this.app;
  }

  private setRoutes(): void {
    this.registerConnectWebSocketServerRoute();
  }

  private registerConnectWebSocketServerRoute(): void {
    const webSocketService = this.webSocketService;

    this.app.openapi(
      createRoute({
        method: "get",
        path: "/",
        summary: "Use websocket",
        description:
          "Upgrades the connection to WebSocket and handles messages from the client",
        tags: ["Server connection"],
        responses: {
          ...ServerResponse.SwitchingProtocols,
          ...ServerResponse.Unauthorized,
        },
      }),
      // @ts-expect-error: upgradeWebSocket helper type mismatch with openapi route
      upgradeWebSocket((context: Context) => {
        const info = getConnInfo(context);
        const publicIp = info.remote.address || "unknown";
        const user = new WebSocketUser(publicIp);

        function ensureWebSocket(ws: WSContext<WebSocket>): void {
          if (!user.getWebSocket()) {
            ws.binaryType = "arraybuffer";
            user.setWebSocket(ws);
          }
        }

        return {
          onMessage: (event, ws) => {
            ensureWebSocket(ws);
            webSocketService.handleMessageEvent(event, user);
          },
          onClose: (event, ws) => {
            ensureWebSocket(ws);
            webSocketService.handleCloseEvent(event, user);
          },
        };
      }),
    );
  }
}
