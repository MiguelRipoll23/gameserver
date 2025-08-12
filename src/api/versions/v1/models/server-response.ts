import { ErrorResponseSchema } from "../schemas/error-response-schema.ts";

export class ServerResponse {
  public static SwitchingProtocols = {
    101: {
      description: "Responds with switching protocols",
    },
  };

  public static OK = {
    200: {
      description: "Responds with OK",
    },
  };

  public static NoContent = {
    204: {
      description: "Responds with no content",
    },
  };

  public static BadRequest = {
    400: {
      description: "Responds with bad request",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  };

  public static Unauthorized = {
    401: {
      description: "Responds with unauthorized",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  };

  public static Forbidden = {
    403: {
      description: "Responds with forbidden",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  };

  public static NotFound = {
    404: {
      description: "Responds with not found",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  };

  public static Conflict = {
    409: {
      description: "Responds with conflict",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  };
}
