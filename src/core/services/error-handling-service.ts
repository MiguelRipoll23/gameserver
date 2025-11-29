import { HTTPException } from "hono/http-exception";
import { OpenAPIHono } from "@hono/zod-openapi";
import { ServerError } from "../../api/versions/v1/models/server-error.ts";
import { HonoVariables } from "../types/hono-variables-type.ts";

export class ErrorHandlingService {
  public static configure(
    app: OpenAPIHono<{ Variables: HonoVariables }>
  ): void {
    app.onError((error, c) => {
      console.error(error);

      if (error instanceof HTTPException) {
        return c.json(
          this.createResponse("HTTP_ERROR", error.message),
          error.status
        );
      } else if (error instanceof ServerError) {
        const response = this.createResponse(
          error.getCode(),
          error.getMessage()
        );

        return c.json(response, error.getStatusCode());
      }

      return c.json(
        this.createResponse("FATAL_ERROR", "Internal server error"),
        500
      );
    });
  }

  private static createResponse(code: string, message: string) {
    return {
      code,
      message,
    };
  }
}
