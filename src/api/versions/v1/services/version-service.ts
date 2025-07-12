import { inject, injectable } from "@needle-di/core";
import { KVService } from "../../../../core/services/kv-service.ts";
import { ServerError } from "../models/server-error.ts";
import { MISSING_VERSION_MESSAGE } from "../constants/api-constants.ts";
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
        MISSING_VERSION_MESSAGE,
        404,
      );
    }

    return response;
  }

  public async set(data: UpdateVersionRequest): Promise<void> {
    await this.kvService.setVersion(data);
  }
}
