import { createMiddleware } from "hono/factory";
import { CACHE_EXCLUDED_PATHS } from "../constants/cache-constants.ts";

export class CacheMiddleware {
  private static cache: Cache | null = null;

  public static async init() {
    this.cache = await caches.open("http-cache");
    console.log("Cache initialized");
  }

  public static create() {
    return createMiddleware(async (c, next) => {
      if (this.cache === null) {
        console.warn("Cache not initialized");
        return await next();
      }

      const request = c.req.raw;

      if (this.mustSkipCache(request)) {
        return await next();
      }

      const cachedResponse = await this.cache.match(request);

      if (cachedResponse) {
        console.debug("🎯 Cache hit", this.getPathFromURL(request.url));
        c.res = cachedResponse;
        return;
      }

      console.debug("💨 Cache miss", this.getPathFromURL(request.url));
      await next();

      if (c.res.ok) {
        c.res.headers.set("Cache-Control", "public, max-age=3600");
        this.cache.put(request, c.res.clone());
      }
    });
  }

  private static mustSkipCache(request: Request): boolean {
    // Check if request is not a GET request
    if (request.method !== "GET") {
      return true;
    }

    // Check if Authorization header is present
    if (request.headers.has("Authorization")) {
      return true;
    }

    // Check if request URL contains any excluded paths
    return CACHE_EXCLUDED_PATHS.some((path) => request.url.includes(path));
  }

  private static getPathFromURL(url: string): string {
    return new URL(url).pathname;
  }
}
