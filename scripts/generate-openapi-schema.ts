import { writeFile } from "node:fs/promises";
import { Container } from "@needle-di/core";
import { HTTPService } from "../src/core/services/http-service.ts";
import { OPENAPI_DOCUMENT_CONFIG } from "../src/core/services/openapi-service.ts";
import { Logger } from "../src/core/utils/logger.ts";

const DEFAULT_OUTPUT_PATH = "openapi.json";

/**
 * Generates the OpenAPI 3.1 schema from the registered routes and writes it to
 * a JSON file (path overridable via the first CLI argument).
 *
 * The `cloudflare:workers` binding is unavailable in plain Node, so run this
 * through the shim loader registered by `register-openapi-loader.mjs` — see the
 * `openapi:generate` npm script. The shim falls back to `process.env`, so a
 * `.env` with `JWT_SECRET` must be present (JWTService reads it at startup).
 */
async function generateOpenAPISchema(): Promise<void> {
  const outputPath = process.argv[2] ?? DEFAULT_OUTPUT_PATH;

  const container = new Container();
  const httpService = container.get(HTTPService);

  const document = httpService.app.getOpenAPI31Document(
    OPENAPI_DOCUMENT_CONFIG,
  );

  await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`);
  Logger.log(`OpenAPI schema written to ${outputPath}`);
}

generateOpenAPISchema().catch((error) => {
  Logger.error(error);
  process.exit(1);
});
