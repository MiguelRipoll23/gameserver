import { z } from "@hono/zod-openapi";

export const GetRegistrationOptionsRequestSchema = z.object({
  transactionId: z
    .uuid()
    .describe("The transaction ID for the registration request")
    .openapi({
      example: "00000000-0000-0000-0000-000000000000",
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
  .looseObject({})
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
    .uuid()
    .describe("The transaction ID for the registration request")
    .openapi({
      example: "00000000-0000-0000-0000-000000000000",
    }),
  registrationResponse: z
    .looseObject({})
    .describe("The registration response from the authenticator"),
});

export type VerifyRegistrationRequest = z.infer<
  typeof VerifyRegistrationRequestSchema
>;
