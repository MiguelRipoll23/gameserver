import { injectable } from "@needle-di/core";
import { DEFAULT_ICE_SERVERS } from "../constants/api-constants.ts";
import {
  ENV_CLOUDFLARE_CALLS_TOKEN,
  ENV_CLOUDFLARE_CALLS_URL,
} from "../constants/environment-constants.ts";
import { RTCIceServer } from "../schemas/authentication-schemas.ts";

@injectable()
export class ICEService {
  public async getServers(): Promise<RTCIceServer[]> {
    let iceServers: RTCIceServer[] = DEFAULT_ICE_SERVERS;

    try {
      iceServers = await this.getCloudflareServers();
    } catch (error) {
      console.error("Failed to get Cloudflare ICE servers", error);
    }

    return iceServers;
  }

  private async getCloudflareServers(): Promise<RTCIceServer[]> {
    const url = Deno.env.get(ENV_CLOUDFLARE_CALLS_URL) ?? null;
    const token = Deno.env.get(ENV_CLOUDFLARE_CALLS_TOKEN) ?? null;

    if (url === null || token === null) {
      throw new Error("Cloudflare environment variables not set");
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ttl: 86400,
      }),
    });

    if (response.ok === false) {
      throw new Error(
        `Failed to fetch Cloudflare ICE servers: ${response.statusText}`
      );
    }

    const data = await response.json();

    return [data.iceServers];
  }
}
