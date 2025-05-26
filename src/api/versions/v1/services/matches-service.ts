import { inject, injectable } from "@needle-di/core";
import {
  AdvertiseMatchRequest,
  FindMatchesRequest,
  FindMatchesResponse,
} from "../schemas/matches-schemas.ts";
import { KVService } from "../../../../core/services/kv-service.ts";
import { SessionKV } from "../interfaces/kv/session-kv.ts";
import { MatchKV } from "../interfaces/kv/match_kv.ts";
import { ServerError } from "../models/server-error.ts";

@injectable()
export class MatchesService {
  constructor(private kvService = inject(KVService)) {}

  public async advertise(
    userId: string,
    body: AdvertiseMatchRequest
  ): Promise<void> {
    // Get the user session
    const session: SessionKV | null = await this.kvService.getSession(userId);

    if (session === null) {
      throw new ServerError("NO_SESSION_FOUND", "User session not found", 400);
    }

    const { token } = session;
    const { version, totalSlots, availableSlots, attributes } = body;

    const match: MatchKV = {
      version: version,
      token,
      totalSlots: totalSlots,
      availableSlots: availableSlots,
      attributes: attributes ?? {},
    };

    const response: Deno.KvCommitResult | Deno.KvCommitError =
      await this.kvService.setMatch(userId, match);

    if (response.ok === false) {
      throw new ServerError(
        "MATCH_CREATION_FAILED",
        "Match creation failed",
        500
      );
    }
  }

  public async find(body: FindMatchesRequest): Promise<FindMatchesResponse> {
    const list: MatchKV[] = [];
    const entries: Deno.KvListIterator<MatchKV> = this.kvService.listMatches();

    for await (const entry of entries) {
      if (list.length >= 50) break;
      list.push(entry.value);
    }

    return this.filter(list, body);
  }

  public async delete(userId: string): Promise<void> {
    const response: Deno.KvCommitResult | Deno.KvCommitError =
      await this.kvService.deleteMatch(userId);

    if (response.ok === false) {
      throw new ServerError(
        "MATCH_DELETION_FAILED",
        "Match deletion failed",
        500
      );
    }
  }

  private filter(
    matches: MatchKV[],
    body: FindMatchesRequest
  ): FindMatchesResponse {
    const results: FindMatchesResponse = [];

    for (const match of matches) {
      if (this.isSameVersion(body, match) === false) {
        continue;
      }

      if (this.hasAvailableSlots(body, match) === false) {
        continue;
      }

      if (this.hasAttributes(body, match) === false) {
        continue;
      }

      const { token } = match;

      results.push({
        token,
      });
    }

    return results;
  }

  private isSameVersion(body: FindMatchesRequest, match: MatchKV): boolean {
    return body.version === match.version;
  }

  private hasAvailableSlots(body: FindMatchesRequest, match: MatchKV): boolean {
    return body.totalSlots <= match.availableSlots;
  }

  private hasAttributes(body: FindMatchesRequest, match: MatchKV): boolean {
    for (const key in body.attributes) {
      if (key in match.attributes === false) {
        return false;
      }

      if (body.attributes[key] !== match.attributes[key]) {
        return false;
      }
    }

    return true;
  }
}
