import { injectable } from "@needle-di/core";
import { ServerError } from "../models/server-error.ts";
import {
  GetVersionResponse,
  GetVersionResponseSchema,
  UpdateVersionRequest,
} from "../schemas/version-schemas.ts";
import { getKvBinding } from "../../../../core/utils/environment.ts";

const VERSION_KEY = "version";

@injectable()
export class VersionService {
  private get versionKv(): KVNamespace {
    return getKvBinding<KVNamespace>("GAME_VERSION_V1_KV");
  }

  public async get(): Promise<GetVersionResponse> {
    const raw = await this.versionKv.get(VERSION_KEY);

    if (raw === null) {
      throw new ServerError(
        "MISSING_VERSION",
        "Missing version information on the server",
        404,
      );
    }

    try {
      return GetVersionResponseSchema.parse(JSON.parse(raw));
    } catch {
      throw new ServerError(
        "INVALID_VERSION",
        "Invalid version information on the server",
        500,
      );
    }
  }

  public async set(data: UpdateVersionRequest): Promise<void> {
    await this.versionKv.put(VERSION_KEY, JSON.stringify(data));
  }
}
