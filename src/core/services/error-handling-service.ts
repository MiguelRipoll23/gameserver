import { HTTPException } from "hono/http-exception";
import { Logger } from "../utils/logger.ts";
import { OpenAPIHono } from "@hono/zod-openapi";
import { ServerError } from "../../api/versions/v1/models/server-error.ts";
import { HonoVariables } from "../types/hono-variables-type.ts";

export class ErrorHandlingService {
  public static configure(
    app: OpenAPIHono<{ Variables: HonoVariables }>,
  ): void {
    app.onError((error, c) => {
      const method = c.req.method;
      const path = c.req.path;

      if (error instanceof HTTPException) {
        Logger.error(
          `${method} ${path} failed with HTTP ${error.status}: ${error.message}`,
        );
        if (error.cause !== undefined) {
          Logger.error(`  cause: ${this.describeCause(error.cause)}`);
        }
        return c.json(
          this.createResponse("HTTP_ERROR", error.message),
          error.status,
        );
      } else if (error instanceof ServerError) {
        const code = error.getCode();
        const message = error.getMessage();
        const status = error.getStatusCode();

        Logger.error(
          `${method} ${path} failed with ${status}: ${code} - ${message}`,
        );

        const response = this.createResponse(code, message);

        return c.json(response, status);
      }

      Logger.error(`${method} ${path} failed with 500:`, error);
      return c.json(
        this.createResponse("FATAL_ERROR", "Internal server error"),
        500,
      );
    });
  }

  private static describeCause(cause: unknown): string {
    if (cause !== null && typeof cause === "object" && "issues" in cause) {
      return JSON.stringify((cause as { issues: unknown }).issues);
    }

    return cause instanceof Error ? cause.message : String(cause);
  }

  private static createResponse(code: string, message: string) {
    return {
      code,
      message,
    };
  }
}
