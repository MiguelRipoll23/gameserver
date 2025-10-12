import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { HonoVariablesType } from "../types/hono-variables-type.ts";

export class OpenAPIService {
  public static configure(
    app: OpenAPIHono<{ Variables: HonoVariablesType }>
  ): void {
    app.openAPIRegistry.registerComponent("securitySchemes", "bearer", {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
    });
  }

  public static setRoutes(
    app: OpenAPIHono<{ Variables: HonoVariablesType }>
  ): void {
    app.doc31("/.well-known/openapi", {
      openapi: "3.1.0",
      info: {
        version: "1.0.0",
        title: "Game server API",
        description: "A game server built with Deno",
      },
    });

    app.get(
      "/",
      Scalar({
        url: "/.well-known/openapi",
        pageTitle: "Game server API",
        metaData: {
          title: "Game server API",
          description: "A game server built for multiplayer games",
          ogTitle: "Game server API",
          ogDescription: "A game server built for multiplayer games",
        },
        darkMode: true,
        defaultOpenAllTags: true,
        authentication: {
          preferredSecurityScheme: "bearer",
        },
        persistAuth: true,
      })
    );
  }
}
