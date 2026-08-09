// Preload hook: registers the `cloudflare:workers` shim loader so it is active
// before the OpenAPI schema generator imports the app. Run via
// `node --import tsx --import ./scripts/register-openapi-loader.mjs`.
import { registerHooks } from "node:module";

const cloudflareWorkersModule =
  "data:text/javascript," +
  encodeURIComponent(
    "const env = new Proxy({}, {\n" +
      "  get: (_target, key) => process.env[key],\n" +
      "  has: () => true,\n" +
      "});\n" +
      "export { env };\n",
  );

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "cloudflare:workers") {
      return {
        url: cloudflareWorkersModule,
        shortCircuit: true,
      };
    }

    // Defer to the next registered hook (tsx, then the default resolver).
    return nextResolve(specifier, context);
  },
});
