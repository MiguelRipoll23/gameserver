import { createMiddleware } from "hono/factory";
import { getConnInfo } from "hono/deno";
import { KVService } from "../services/kv-service.ts";
import {
  RATE_REQUESTS_LIMIT,
  RATE_WINDOW_MILLISECONDS,
} from "../../api/versions/v1/constants/api-constants.ts";
import { ServerError } from "../../api/versions/v1/models/server-error.ts";

export class RateLimiterMiddleware {
  public static create(kvService: KVService) {
    return createMiddleware(async (context, next) => {
      const {
        remote: { address = "unknown" },
      } = getConnInfo(context);

      const currentTime = Date.now();
      const storedTimestamps = await kvService.getRateLimit(address);

      // Filter out timestamps that are older than the rate window
      const validTimestamps =
        storedTimestamps?.filter(
          (timeStamp) => currentTime - timeStamp < RATE_WINDOW_MILLISECONDS
        ) || [];

      // Check if rate limit has been exceeded
      if (validTimestamps.length >= RATE_REQUESTS_LIMIT) {
        throw new ServerError(
          "RATE_LIMIT_EXCEEDED",
          `Rate limit exceeded (${address})`,
          429
        );
      }

      // Update the list of timestamps with the current time
      await kvService.setRateLimit(address, [...validTimestamps, currentTime]);

      // Proceed with the next middleware or request handler
      await next();
    });
  }
}
