import { inject, injectable } from "@needle-di/core";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { ErrorResponseSchema } from "../../schemas/error-response-schema.ts";
import { RegistrationService } from "../../services/registration-service.ts";
import { getConnInfo } from "hono/deno";
import { VerifyAuthenticationResponseSchema } from "../../schemas/authentication-schemas.ts";
import {
  GetRegistrationOptionsRequestSchema,
  GetRegistrationOptionsResponseSchema,
  VerifyRegistrationRequestSchema,
} from "../../schemas/registration-schemas.ts";
import { ServerResponse } from "../../models/server-response.ts";

@injectable()
export class PublicRegistrationRouter {
  private app: OpenAPIHono;

  constructor(private registrationService = inject(RegistrationService)) {
    this.app = new OpenAPIHono();
    this.setRoutes();
  }

  public getRouter(): OpenAPIHono {
    return this.app;
  }

  private setRoutes(): void {
    this.registerGetRegistrationOptionsRoute();
    this.registerVerifyRegistrationResponseRoute();
  }

  private registerGetRegistrationOptionsRoute(): void {
    this.app.openapi(
      createRoute({
        method: "post",
        path: "/options",
        summary: "Get registration options",
        description: "Registration options for a new credential",
        tags: ["User registration"],
        request: {
          body: {
            content: {
              "application/json": {
                schema: GetRegistrationOptionsRequestSchema,
              },
            },
          },
        },
        responses: {
          200: {
            description: "Responds with data",
            content: {
              "application/json": {
                schema: GetRegistrationOptionsResponseSchema,
              },
            },
          },
          409: {
            description:
              "Responds with an error when the chosen display name is already taken",
            content: {
              "application/json": {
                schema: ErrorResponseSchema,
              },
            },
          },
          ...ServerResponse.BadRequest,
        },
      }),
      async (c) => {
        const validated = c.req.valid("json");
        const origin = c.req.header("Origin") ?? c.req.header("Referer");
        
        if (!origin) {
          return c.json({ error: "Missing Origin or Referer header" }, 400);
        }

        const response = await this.registrationService.getOptions(validated, origin);

        return c.json(response, 200);
      }
    );
  }

  private registerVerifyRegistrationResponseRoute(): void {
    this.app.openapi(
      createRoute({
        method: "post",
        path: "/response",
        summary: "Verify registration response",
        description: "Result of a registration attempt for a new credential",
        tags: ["User registration"],
        request: {
          body: {
            content: {
              "application/json": {
                schema: VerifyRegistrationRequestSchema,
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
        const origin = c.req.header("Origin") ?? c.req.header("Referer");
        
        if (!origin) {
          return c.json({ error: "Missing Origin or Referer header" }, 400);
        }

        const response = await this.registrationService.verifyResponse(
          connInfo,
          validated,
          origin
        );

        return c.json(response, 200);
      }
    );
  }
}
