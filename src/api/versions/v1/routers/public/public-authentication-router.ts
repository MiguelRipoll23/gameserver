import { inject, injectable } from "@needle-di/core";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { AuthenticationService } from "../../services/authentication-service.ts";
import { getConnInfo } from "hono/deno";
import {
  DeviceAuthorizationCompleteRequestSchema,
  DeviceAuthorizationMintResponseSchema,
  DeviceAuthorizationPollRequestSchema,
  DeviceAuthorizationPollResponseSchema,
  GetAuthenticationOptionsRequestSchema,
  GetAuthenticationOptionsResponseSchema,
  RefreshTokenRequestSchema,
  RefreshTokenResponseSchema,
  VerifyAuthenticationRequestSchema,
  VerifyAuthenticationResponseSchema,
} from "../../schemas/authentication-schemas.ts";
import { ServerResponse } from "../../models/server-response.ts";
import { ServerError } from "../../models/server-error.ts";
import { extractAndValidateOrigin } from "../../utils/origin-utils.ts";
import { DeviceAuthorizationCodesService } from "../../services/device-authorization-codes-service.ts";
import { WebAuthnUtils } from "../../../../../core/utils/webauthn-utils.ts";

@injectable()
export class PublicAuthenticationRouter {
  private app: OpenAPIHono;

  constructor(
    private authenticationService = inject(AuthenticationService),
    private deviceAuthorizationCodesService = inject(DeviceAuthorizationCodesService),
  ) {
    this.app = new OpenAPIHono();
    this.setRoutes();
  }

  public getRouter(): OpenAPIHono {
    return this.app;
  }

  private setRoutes(): void {
    this.registerGetAuthenticationOptionsRoute();
    this.registerVerifyAuthenticationResponseRoute();
    this.registerRefreshTokenRoute();
    this.registerDeviceAuthorizationMintRoute();
    this.registerDeviceAuthorizationCompleteRoute();
    this.registerDeviceAuthorizationPollRoute();
  }

  private registerGetAuthenticationOptionsRoute(): void {
    this.app.openapi(
      createRoute({
        method: "post",
        path: "/options",
        summary: "Get authentication options",
        description: "Authentication options for a new credential",
        tags: ["User authentication"],
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
          ...ServerResponse.Forbidden,
        },
      }),
      async (c) => {
        const validated = c.req.valid("json");
        const origin = extractAndValidateOrigin(c);

        const response = await this.authenticationService.getOptions(validated, origin);

        return c.json(response, 200);
      }
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
        tags: ["User authentication"],
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
          ...ServerResponse.Forbidden,
          ...ServerResponse.Conflict,
        },
      }),
      async (c) => {
        const connInfo = getConnInfo(c);
        const validated = c.req.valid("json");
        const origin = extractAndValidateOrigin(c);

        const response = await this.authenticationService.verifyResponse(
          connInfo,
          validated,
          origin
        );

        return c.json(response, 200);
      }
    );
  }

  private registerRefreshTokenRoute(): void {
    this.app.openapi(
      createRoute({
        method: "post",
        path: "/refresh",
        summary: "Refresh access token",
        description: "Rotates a refresh token and returns a new access token pair",
        tags: ["User authentication"],
        request: {
          body: {
            content: {
              "application/json": {
                schema: RefreshTokenRequestSchema,
              },
            },
          },
        },
        responses: {
          200: {
            description: "Responds with data",
            content: {
              "application/json": {
                schema: RefreshTokenResponseSchema,
              },
            },
          },
          ...ServerResponse.BadRequest,
          ...ServerResponse.Unauthorized,
          ...ServerResponse.Forbidden,
        },
      }),
      async (c) => {
        const validated = c.req.valid("json");
        const response = await this.authenticationService.refreshTokens(validated);

        return c.json(response, 200);
      },
    );
  }

  private registerDeviceAuthorizationMintRoute(): void {
    this.app.openapi(
      createRoute({
        method: "post",
        path: "/device-authorization",
        summary: "Create a device authorization code",
        description:
          "Issues a new short-lived code the bot shows to the user to authorize a device",
        tags: ["User authentication"],
        responses: {
          200: {
            description: "Responds with the issued code and its expiry",
            content: {
              "application/json": {
                schema: DeviceAuthorizationMintResponseSchema,
              },
            },
          },
          ...ServerResponse.BadRequest,
        },
      }),
      async (c) => {
        const { code, expiresAt } =
          await this.deviceAuthorizationCodesService.create();

        return c.json({ code, expiresAt: expiresAt.toISOString() }, 200);
      },
    );
  }

  private registerDeviceAuthorizationCompleteRoute(): void {
    this.app.openapi(
      createRoute({
        method: "post",
        path: "/device-authorization/complete",
        summary: "Store device authorization tokens",
        description:
          "Stores the token pair issued to a browser against a device authorization code",
        tags: ["User authentication"],
        request: {
          body: {
            content: {
              "application/json": {
                schema: DeviceAuthorizationCompleteRequestSchema,
              },
            },
          },
        },
        responses: {
          ...ServerResponse.NoContent,
          ...ServerResponse.BadRequest,
          ...ServerResponse.NotFound,
          ...ServerResponse.Forbidden,
        },
      }),
      async (c) => {
        const validated = c.req.valid("json");
        const origin = extractAndValidateOrigin(c);

        if (!WebAuthnUtils.isOriginAllowed(origin)) {
          throw new ServerError(
            "ORIGIN_NOT_ALLOWED",
            "Origin is not in the allowed list",
            403,
          );
        }

        await this.deviceAuthorizationCodesService.save(
          validated.code,
          validated.accessToken,
          validated.refreshToken,
        );

        return c.body(null, 204);
      },
    );
  }

  private registerDeviceAuthorizationPollRoute(): void {
    this.app.openapi(
      createRoute({
        method: "post",
        path: "/device-authorization/poll",
        summary: "Retrieve device authorization tokens",
        description:
          "Returns and consumes the token pair stored for a device authorization code",
        tags: ["User authentication"],
        request: {
          body: {
            content: {
              "application/json": {
                schema: DeviceAuthorizationPollRequestSchema,
              },
            },
          },
        },
        responses: {
          200: {
            description: "Responds with the token pair",
            content: {
              "application/json": {
                schema: DeviceAuthorizationPollResponseSchema,
              },
            },
          },
          ...ServerResponse.NotFound,
        },
      }),
      async (c) => {
        const { code } = c.req.valid("json");

        const tokenPair = await this.deviceAuthorizationCodesService.consume(code);

        if (tokenPair === null) {
          throw new ServerError(
            "DEVICE_AUTHORIZATION_CODE_NOT_FOUND",
            "Device authorization code not found or expired",
            404,
          );
        }

        return c.json(tokenPair, 200);
      },
    );
  }
}
