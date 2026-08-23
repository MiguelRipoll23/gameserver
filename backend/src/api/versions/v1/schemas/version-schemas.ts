import { z } from "@hono/zod-openapi";

export const GetVersionResponseSchema = z.object({
  minimumVersion: z
    .string()
    .describe("The minimum version of the game client")
    .openapi({
      example: "1.0.0-alpha.1",
    }),
});

export type GetVersionResponse = z.infer<typeof GetVersionResponseSchema>;

export const UpdateVersionRequestSchema = z.object({
  minimumVersion: z
    .string()
    .describe("The minimum version of the game client")
    .openapi({
      example: "1.0.0-alpha.1",
    }),
});

export type UpdateVersionRequest = z.infer<typeof UpdateVersionRequestSchema>;
