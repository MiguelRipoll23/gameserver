export class AuthenticationRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationRejectedError";
  }
}