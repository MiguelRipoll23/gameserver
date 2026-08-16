import { injectable } from "@needle-di/core";
import { ENV_DISCORD_BOT_TOKEN } from "../constants/environment-constants.ts";
import { env } from "cloudflare:workers";

const DISCORD_API_BASE = "https://discord.com/api/v10";
const ROLE_CACHE_TTL_MS = 60_000;

interface DiscordRole {
  id: string;
  name: string;
}

@injectable()
export class DiscordRestService {
  private readonly token: string;
  private readonly roleCache = new Map<
    string,
    { byId: Map<string, string>; at: number }
  >();

  constructor() {
    this.token = env[ENV_DISCORD_BOT_TOKEN] ?? "";
  }

  public async hasAllowedRole(
    guildId: string,
    memberRoleIds: string[],
    allowedRoleNames: string[],
  ): Promise<boolean> {
    if (allowedRoleNames.length === 0) return false;

    const allowed = allowedRoleNames
      .map((name) => name.trim().toLowerCase())
      .filter(Boolean);
    if (allowed.length === 0) return false;

    const guildRoles = await this.getGuildRoles(guildId);

    return memberRoleIds.some((id) => {
      const roleName = guildRoles.get(id);
      return roleName !== undefined && allowed.includes(roleName);
    });
  }

  private async getGuildRoles(guildId: string): Promise<Map<string, string>> {
    const cached = this.roleCache.get(guildId);
    if (cached && Date.now() - cached.at < ROLE_CACHE_TTL_MS) {
      return cached.byId;
    }

    const resp = await fetch(
      `${DISCORD_API_BASE}/guilds/${guildId}/roles`,
      {
        headers: { Authorization: `Bot ${this.token}` },
        signal: AbortSignal.timeout(5000),
      },
    );

    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      throw new Error(
        `Failed to fetch Discord roles for guild ${guildId} (HTTP ${resp.status}` +
          `${detail ? `: ${detail}` : ""})`,
      );
    }

    const roles = await resp.json() as DiscordRole[];
    const byId = new Map<string, string>();
    for (const role of roles) {
      byId.set(role.id, role.name.toLowerCase());
    }

    this.roleCache.set(guildId, { byId, at: Date.now() });
    return byId;
  }
}
