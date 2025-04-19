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
        description: "A game server built with Deno KV",
      },
    });

    app.get(
      "/",
      Scalar({
        url: "/.well-known/openapi",
        pageTitle: "Game server API",
        favicon: "https://fav.farm/🎮",
        metaData: {
          title: "Game server API",
          description: "A game server built with Deno KV",
          ogTitle: "Game server API",
          ogDescription: "A game server built with Deno KV",
        },
        darkMode: true,
        defaultOpenAllTags: true,
        authentication: {
          preferredSecurityScheme: "bearer",
        },
      })
    );
  }
}
