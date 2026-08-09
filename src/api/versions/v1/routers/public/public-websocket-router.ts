import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { injectable } from "@needle-di/core";
import { getHubStub } from "../../../../../core/utils/environment.ts";
import { HonoVariables } from "../../../../../core/types/hono-variables-type.ts";
import { ServerResponse } from "../../models/server-response.ts";

@injectable()
export class AuthenticatedWebSocketRouter {
  private app: OpenAPIHono<{ Variables: HonoVariables }>;

  constructor() {
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
    this.app.openapi(
      createRoute({
        method: "get",
        path: "/",
        summary: "Use websocket",
        description:
          "Upgrades the connection to WebSocket and handles messages from the client",
        tags: ["Server connection"],
        security: [],
        responses: {
          ...ServerResponse.SwitchingProtocols,
          ...ServerResponse.Unauthorized,
        },
      }),
      (c) => {
        // WebSocket connections are owned by the WebSocketDurableObject.
        // Forward the upgrade request to the hub, which accepts it and
        // services all messages for the connection.
        const hub = getHubStub();
        return hub.fetch(c.req.raw);
      },
    );
  }
}