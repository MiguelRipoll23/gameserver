import { z } from "@hono/zod-openapi";

export const UpdateConfigurationRequestSchema = z
  .looseObject({})
  .describe("The cloud game configuration from the server")
  .openapi({
    example: {
      "44CFA650": 60,
      "9090BF7D": 4,
    },
  });

export type UpdateConfigurationRequest = z.infer<
  typeof UpdateConfigurationRequestSchema
>;

export const GetConfigurationResponseSchema = z
  .looseObject({})
  .describe("The cloud game configuration from the server")
  .openapi({
    example: {
      "48CFA270": 60,
      "4030BF2D": 4,
    },
  });

export type GetConfigurationResponse = z.infer<
  typeof GetConfigurationResponseSchema
>;
