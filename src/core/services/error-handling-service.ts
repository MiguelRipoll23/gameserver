import { HTTPException } from "hono/http-exception";
import { OpenAPIHono } from "@hono/zod-openapi";
import { ServerError } from "../../api/versions/v1/models/server-error.ts";
import { HonoVariablesType } from "../types/hono-variables-type.ts";
import {
  INTERNAL_SERVER_ERROR_MESSAGE,
} from "../../api/versions/v1/constants/api-constants.ts";

export class ErrorHandlingService {
  public static configure(
    app: OpenAPIHono<{ Variables: HonoVariablesType }>,
  ): void {
    app.onError((error, c) => {
      console.error(error);

      if (error instanceof HTTPException) {
        return c.json(
          this.createResponse("HTTP_ERROR", error.message),
          error.status,
        );
      } else if (error instanceof ServerError) {
        const response = this.createResponse(
          error.getCode(),
          error.getMessage(),
        );

        return c.json(response, error.getStatusCode());
      }

      return c.json(
        this.createResponse("FATAL_ERROR", INTERNAL_SERVER_ERROR_MESSAGE),
        500,
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
