import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { HonoVariables } from "../types/hono-variables-type.ts";

// Shared document metadata so the served endpoint (`/.well-known/openapi`)
// and the `npm run generate:openapi` script produce the same schema.
export const OPENAPI_DOCUMENT_CONFIG = {
  openapi: "3.1.0",
  info: {
    version: "1.0.0",
    title: "Game server API",
    description: "A game server for multiplayer peer-to-peer games",
  },
  // Requires a bearer token by default. Public operations explicitly
  // opt out with `security: []`.
  security: [{ bearer: [] }],
};

export class OpenAPIService {
  public static configure(
    app: OpenAPIHono<{ Variables: HonoVariables }>,
  ): void {
    app.openAPIRegistry.registerComponent("securitySchemes", "bearer", {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
    });
  }

  public static setRoutes(
    app: OpenAPIHono<{ Variables: HonoVariables }>,
  ): void {
    app.doc31("/.well-known/openapi", OPENAPI_DOCUMENT_CONFIG);

    app.get(
      "/",
      Scalar({
        url: "/.well-known/openapi",
        pageTitle: "Game server API",
        metaData: {
          title: "Game server API",
          description: "A game server for multiplayer peer-to-peer games",
          ogTitle: "Game server API",
          ogDescription: "A game server built for multiplayer games",
        },
        darkMode: true,
        defaultOpenAllTags: true,
        authentication: {
          preferredSecurityScheme: "bearer",
        },
        persistAuth: true,
      }),
    );
  }
}
