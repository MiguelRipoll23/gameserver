import { z } from "@hono/zod-openapi";

export const ErrorResponseSchema = z.object({
  code: z.string().describe("The error code"),
  message: z.string().describe("The error message"),
});
