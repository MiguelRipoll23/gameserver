import { createMiddleware } from "hono/factory";

export class CORSMiddleware {
  public static create(): ReturnType<typeof createMiddleware> {
    return createMiddleware(async (c, next) => {
      // Skip CORS headers for WebSocket requests
      if (c.req.path.includes("/websocket")) {
        return next();
      }

      // Set CORS headers for all requests
      c.header("Access-Control-Allow-Origin", "*");
      c.header("Access-Control-Allow-Methods", "*");
      c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

      // Handle preflight requests (OPTIONS)
      if (c.req.method === "OPTIONS") {
        return c.body(null, 204); // Respond with an empty body
      }

      // Continue to the next middleware/handler
      await next();
    });
  }
}
