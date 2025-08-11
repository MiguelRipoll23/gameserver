import { OpenAPIHono } from "@hono/zod-openapi";
import { V1Router } from "../versions/v1/routers/v1-rooter.ts";
import { inject, injectable } from "@needle-di/core";
import { CORSMiddleware } from "../../core/middlewares/cors-middleware.ts";

@injectable()
export class APIRouter {
  private app: OpenAPIHono;

  constructor(private v1Router = inject(V1Router)) {
    this.app = new OpenAPIHono();
    this.setMiddlewares();
    this.setRoutes();
  }

  public async init(): Promise<void> {
    await this.v1Router.init();
  }

  public getRouter(): OpenAPIHono {
    return this.app;
  }

  private setMiddlewares(): void {
    this.app.use("*", CORSMiddleware.create());
  }

  private setRoutes(): void {
    this.app.route("/v1", this.v1Router.getRouter());
  }
}
