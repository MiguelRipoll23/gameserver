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
    .uuid()
    .describe("The transaction ID for the authentication request")
    .openapi({
      example: "00000000-0000-0000-0000-000000000000",
    }),
});

export type GetAuthenticationOptionsRequest = z.infer<
  typeof GetAuthenticationOptionsRequestSchema
>;

export const GetAuthenticationOptionsResponseSchema = z
  .looseObject({})
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
    .uuid()
    .describe("The transaction ID for the authentication request")
    .openapi({
      example: "00000000-0000-0000-0000-000000000000",
    }),
  authenticationResponse: z
    .looseObject({})
    .describe("The authentication response from the authenticator"),
});

export type VerifyAuthenticationRequest = z.infer<
  typeof VerifyAuthenticationRequestSchema
>;

export const VerifyAuthenticationResponseSchema = z.object({
  authenticationToken: z
    .string()
    .describe("The JWT to authenticate with the server"),
  userId: z
    .string()
    .length(36)
    .describe("Unique identifier for the authenticated user (UUIDv4)")
    .openapi({ example: "00000000-0000-0000-0000-000000000000" }),
  userDisplayName: z
    .string()
    .describe("The public display name chosen by the user")
    .openapi({ example: "MiguelRipoll23" }),
  userPublicIp: z
    .union([z.ipv4(), z.ipv6()])
    .nullable()
    .describe("The user's public IPv4 or IPv6 address, if available")
    .openapi({ example: "1.1.1.1" }),
  userSymmetricKey: z
    .string()
    .describe(
      "Symmetric key generated for encrypting and decrypting the user's game session data"
    ),
  serverSignaturePublicKey: z
    .string()
    .describe(
      "Public key used to verify digital signatures from connected peers"
    ),
  rtcIceServers: z
    .array(RTCIceServerSchema)
    .describe(
      "List of ICE servers (STUN/TURN) to facilitate WebRTC connectivity for the user"
    ),
});

export type AuthenticationResponse = z.infer<
  typeof VerifyAuthenticationResponseSchema
>;
