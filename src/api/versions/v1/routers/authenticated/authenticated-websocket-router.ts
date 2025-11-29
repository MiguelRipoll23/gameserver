import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { inject, injectable } from "@needle-di/core";
import { upgradeWebSocket } from "hono/deno";
import { getConnInfo } from "hono/deno";
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
      // @ts-expect-error: using helper
      upgradeWebSocket((c) => {
        const id = c.get("userId");
        const name = c.get("userName");

        // Get client IP address
        const info = getConnInfo(c);
        const publicIp = info.remote.address || "unknown";

        const user = new WebSocketUser(id, name, publicIp);

        return {
          onOpen: (event, webSocketContext) => {
            webSocketContext.binaryType = "arraybuffer";
            user.setWebSocket(webSocketContext);
            webSocketService.handleOpenEvent(event, user);
          },

          onMessage(event) {
            webSocketService.handleMessageEvent(event, user);
          },

          onClose: (event) => {
            webSocketService.handleCloseEvent(event, user);
          },
        };
      })
    );
  }
}
