import { z } from "@hono/zod-openapi";

export const RTCIceServerSchema = z.object({
  urls: z.union([z.string(), z.array(z.string())]),
  username: z.string().optional(),
  credential: z.string().optional(),
  credentialType: z.enum(["password", "oauth"]).optional().openapi({
    example: "password",
  }),
});

export type RTCIceServer = z.infer<typeof RTCIceServerSchema>;

export const GetAuthenticationOptionsRequestSchema = z.object({
  transactionId: z
    .string()
    .uuid()
    .describe("The transaction ID for the authentication request")
    .openapi({
      example: "123e4567-e89b-12d3-a456-426614174000",
    }),
});

export type GetAuthenticationOptionsRequest = z.infer<
  typeof GetAuthenticationOptionsRequestSchema
>;

export const GetAuthenticationOptionsResponseSchema = z
  .object({})
  .passthrough()
  .describe("The authentication options required by the server")
  .openapi({
    example: {
      rpId: "…",
      challenge: "…",
      timeout: 60000,
      userVerification: "preferred",
    },
  });

export type GetAuthenticationOptionsResponse = z.infer<
  typeof GetAuthenticationOptionsResponseSchema
>;

export const VerifyAuthenticationRequestSchema = z.object({
  transactionId: z
    .string()
    .uuid()
    .describe("The transaction ID for the authentication request")
    .openapi({
      example: "123e4567-e89b-12d3-a456-426614174000",
    }),
  authenticationResponse: z
    .object({})
    .passthrough()
    .describe("The authentication response from the authenticator"),
});

export type VerifyAuthenticationRequest = z.infer<
  typeof VerifyAuthenticationRequestSchema
>;

export const VerifyAuthenticationResponseSchema = z.object({
  userId: z.string().describe("The user ID"),
  displayName: z.string().describe("The display name of the user"),
  authenticationToken: z
    .string()
    .describe("The authentication token of the user"),
  sessionKey: z.string().describe("The session key of the user"),
  publicIp: z
    .string()
    .ip()
    .nullable()
    .describe("The public IP of the user")
    .openapi({ example: "…" }),
  rtcIceServers: z
    .array(RTCIceServerSchema)
    .describe("The RTC ICE servers for the user"),
});

export type AuthenticationResponse = z.infer<
  typeof VerifyAuthenticationResponseSchema
>;
