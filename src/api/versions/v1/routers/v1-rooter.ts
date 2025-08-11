import { OpenAPIHono } from "@hono/zod-openapi";
import { V1PublicRouter } from "./public-router.ts";
import { V1AuthenticatedRouter } from "./authenticated-router.ts";
import { inject, injectable } from "@needle-di/core";
import { V1ManagementUserRouter } from "./management-router.ts";
import { SignatureService } from "../services/signature-service.ts";

@injectable()
export class V1Router {
  private app: OpenAPIHono;

  constructor(
    private publicRouter = inject(V1PublicRouter),
    private authenticatedRouter = inject(V1AuthenticatedRouter),
    private managementRouter = inject(V1ManagementUserRouter),
    private signatureService = inject(SignatureService)
  ) {
    this.app = new OpenAPIHono();
    this.setRoutes();
  }

  public async init(): Promise<void> {
    await this.signatureService.init();
  }

  public getRouter(): OpenAPIHono {
    return this.app;
  }

  private setRoutes(): void {
    this.app.route("/", this.publicRouter.getRouter());
    this.app.route("/", this.authenticatedRouter.getRouter());
    this.app.route("/", this.managementRouter.getRouter());
  }
}
