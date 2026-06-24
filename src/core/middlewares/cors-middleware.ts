import { createMiddleware } from "hono/factory";

export class CORSMiddleware {
  public static create(): ReturnType<typeof createMiddleware> {
    return createMiddleware(async (c, next) => {
      // Skip CORS headers for WebSocket requests
      if (c.req.path.includes("/websocket")) {
        return next();
      }

      const origin = c.req.header("Origin");

      // Set CORS headers for all requests
      if (origin) {
        // Use the specific origin (required by browsers for credentialed requests)
        c.header("Access-Control-Allow-Origin", origin);
        c.header("Vary", "Origin");
        c.header("Access-Control-Allow-Credentials", "true");
      } else {
        c.header("Access-Control-Allow-Origin", "*");
      }
      c.header("Access-Control-Allow-Methods", "*");
      c.header(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization",
      );

      // Handle preflight requests (OPTIONS)
      if (c.req.method === "OPTIONS") {
        return c.body(null, 204); // Respond with an empty body
      }

      // Continue to the next middleware/handler
      await next();
    });
  }
}
