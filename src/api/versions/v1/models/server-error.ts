import { ContentfulStatusCode } from "hono/utils/http-status";

export class ServerError extends Error {
  private code: string;
  private statusCode: ContentfulStatusCode;

  constructor(code: string, message: string, statusCode: ContentfulStatusCode) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }

  getCode(): string {
    return this.code;
  }

  getMessage(): string {
    return this.message;
  }

  getStatusCode(): ContentfulStatusCode {
    return this.statusCode;
  }
}
