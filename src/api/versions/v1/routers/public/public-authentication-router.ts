import { inject, injectable } from "@needle-di/core";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { AuthenticationService } from "../../services/authentication-service.ts";
import { getConnInfo } from "hono/deno";
import {
  GetAuthenticationOptionsRequestSchema,
  GetAuthenticationOptionsResponseSchema,
  VerifyAuthenticationRequestSchema,
  VerifyAuthenticationResponseSchema,
} from "../../schemas/authentication-schemas.ts";
import { ServerResponse } from "../../models/server-response.ts";

@injectable()
export class PublicAuthenticationRouter {
  private app: OpenAPIHono;

  constructor(private authenticationService = inject(AuthenticationService)) {
    this.app = new OpenAPIHono();
    this.setRoutes();
  }

  public getRouter(): OpenAPIHono {
    return this.app;
  }

  private setRoutes(): void {
    this.registerGetAuthenticationOptionsRoute();
    this.registerVerifyAuthenticationResponseRoute();
  }

  private registerGetAuthenticationOptionsRoute(): void {
    this.app.openapi(
      createRoute({
        method: "post",
        path: "/options",
        summary: "Get authentication options",
        description: "Authentication options for a new credential",
        tags: ["Authentication"],
        request: {
          body: {
            content: {
              "application/json": {
                schema: GetAuthenticationOptionsRequestSchema,
              },
            },
          },
        },
        responses: {
          200: {
            description: "Responds with data",
            content: {
              "application/json": {
                schema: GetAuthenticationOptionsResponseSchema,
              },
            },
          },
          ...ServerResponse.BadRequest,
        },
      }),
      async (c) => {
        const validated = c.req.valid("json");
        const response = await this.authenticationService.getOptions(validated);

        return c.json(response, 200);
      },
    );
  }

  private registerVerifyAuthenticationResponseRoute(): void {
    this.app.openapi(
      createRoute({
        method: "post",
        path: "/response",
        summary: "Verify authentication response",
        description:
          "Result of an authentication attempt for an existing credential",
        tags: ["Authentication"],
        request: {
          body: {
            content: {
              "application/json": {
                schema: VerifyAuthenticationRequestSchema,
              },
            },
          },
        },
        responses: {
          200: {
            description: "Responds with data",
            content: {
              "application/json": {
                schema: VerifyAuthenticationResponseSchema,
              },
            },
          },
          ...ServerResponse.BadRequest,
        },
      }),
      async (c) => {
        const connInfo = getConnInfo(c);
        const validated = c.req.valid("json");
        const response = await this.authenticationService.verifyResponse(
          connInfo,
          validated,
        );

        return c.json(response, 200);
      },
    );
  }
}
