import { inject, injectable } from "@needle-di/core";
import { KVService } from "../../../../core/services/kv-service.ts";
import { ServerError } from "../models/server-error.ts";
import {
  GetVersionResponse,
  UpdateVersionRequest,
} from "../schemas/version-schemas.ts";

@injectable()
export class VersionService {
  constructor(private kvService = inject(KVService)) {}

  public async get(): Promise<GetVersionResponse> {
    const response = await this.kvService.getVersion();

    if (response === null) {
      throw new ServerError(
        "MISSING_VERSION",
        "Missing version information on the server",
        404,
      );
    }

    return response;
  }

  public async set(data: UpdateVersionRequest): Promise<void> {
    await this.kvService.setVersion(data);
  }
}
