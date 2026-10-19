import { createMiddleware } from "hono/factory";

export class CORSMiddleware {
  public static create(): ReturnType<typeof createMiddleware> {
    return createMiddleware(async (c, next) => {
      // Skip CORS headers for WebSocket requests
      if (c.req.path.includes("/websocket")) {
        return next();
      }

      // Handle preflight requests (OPTIONS)
      if (c.req.method === "OPTIONS") {
        c.header("Access-Control-Allow-Origin", "*");
        c.header("Access-Control-Allow-Methods", "*");
        c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
        return c.body(null, 204); // Respond with an empty body
      }

      // Set CORS headers before invoking the handler so they are also present
      // on error responses produced by the app-level onError handler.
      c.header("Access-Control-Allow-Origin", "*");
      c.header("Access-Control-Allow-Methods", "*");
      c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

      // Continue to the next middleware/handler
      await next();
    });
  }
}
