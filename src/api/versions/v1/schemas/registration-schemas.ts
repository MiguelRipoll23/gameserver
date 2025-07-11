import { z } from "@hono/zod-openapi";

export const GetRegistrationOptionsRequestSchema = z.object({
  transactionId: z
    .string()
    .uuid()
    .describe("The transaction ID for the registration request")
    .openapi({
      example: "123e4567-e89b-12d3-a456-426614174000",
    }),
  displayName: z
    .string()
    .min(1)
    .max(16)
    .describe("The display name for the user")
    .openapi({ example: "MiguelRipoll23" }),
});

export type GetRegistrationOptionsRequest = z.infer<
  typeof GetRegistrationOptionsRequestSchema
>;

export const GetRegistrationOptionsResponseSchema = z
  .object({})
  .passthrough()
  .describe("The registration options required by the server")
  .openapi({
    example: {
      challenge: "…",
      rp: {
        name: "…",
        id: "…",
      },
      user: {
        id: "…",
        name: "…",
        displayName: "…",
      },
      pubKeyCredParams: [
        {
          alg: -8,
          type: "public-key",
        },
        {
          alg: -7,
          type: "public-key",
        },
        {
          alg: -257,
          type: "public-key",
        },
      ],
      timeout: 60000,
      attestation: "none",
      excludeCredentials: [],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "required",
        requireResidentKey: true,
      },
      extensions: {
        credProps: true,
      },
      hints: [],
    },
  });

export type GetRegistrationOptionsResponse = z.infer<
  typeof GetRegistrationOptionsResponseSchema
>;

export const VerifyRegistrationRequestSchema = z.object({
  transactionId: z
    .string()
    .uuid()
    .describe("The transaction ID for the registration request")
    .openapi({
      example: "123e4567-e89b-12d3-a456-426614174000",
    }),
  registrationResponse: z
    .object({})
    .passthrough()
    .describe("The registration response from the authenticator"),
});

export type VerifyRegistrationRequest = z.infer<
  typeof VerifyRegistrationRequestSchema
>;
