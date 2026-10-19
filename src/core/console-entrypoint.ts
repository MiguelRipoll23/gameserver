import { Container } from "@needle-di/core";
import { env, WorkerEntrypoint } from "cloudflare:workers";
import { z } from "zod";
import { ConfigurationService } from "../api/versions/v1/services/configuration-service.ts";
import { NotificationService } from "../api/versions/v1/services/notification-service.ts";
import { VersionService } from "../api/versions/v1/services/version-service.ts";
import {
  NotificationChannelName,
  NotificationChannelNameToType,
} from "../api/versions/v1/enums/notification-channel-enum.ts";
import { WEBSOCKET_DURABLE_OBJECT_NAME } from "../api/versions/v1/constants/durable-object-constants.ts";
import { ServerError } from "../api/versions/v1/models/server-error.ts";
import { HTTPService } from "./services/http-service.ts";
import type { GetVersionResponse } from "../api/versions/v1/schemas/version-schemas.ts";
import type { GetConfigurationResponse } from "../api/versions/v1/schemas/configuration-schemas.ts";

const ChannelSchema = z.enum([
  NotificationChannelName.Global,
  NotificationChannelName.Menu,
  NotificationChannelName.Match,
]);

const VersionSchema = z.object({ minimumVersion: z.string().min(1) });

const ConfigurationSchema = z.record(z.string(), z.unknown());

const NotificationSchema = z.object({
  channelName: ChannelSchema,
  text: z.string().min(1),
});

const UserNotificationSchema = NotificationSchema.extend({
  userId: z.string().uuid(),
});

const UserSchema = z.object({ userId: z.string().uuid() });

const AntiCheatConfigSchema = z.object({ rules: z.string().min(1) });

const container = new Container();

let httpService: HTTPService | null = null;

function getHTTPService(): HTTPService {
  if (httpService === null) {
    httpService = container.get(HTTPService);
  }

  return httpService;
}

let services: {
  configuration: ConfigurationService;
  notification: NotificationService;
  version: VersionService;
} | null = null;

function getServices(): NonNullable<typeof services> {
  if (services === null) {
    services = {
      configuration: container.get(ConfigurationService),
      notification: container.get(NotificationService),
      version: container.get(VersionService),
    };
  }

  return services;
}

/**
 * RPC surface the `gameserver-console` backend calls through a service binding.
 *
 * Some management actions need code that only runs inside this Worker (kicking
 * a player, pushing notifications through the WebSocket Durable Object,
 * refreshing its blocked-words cache, broadcasting anti-cheat config) and some
 * state lives in its KV namespace. The console performs the database writes
 * itself and calls these methods for those side effects.
 *
 * The binding never leaves the Cloudflare account, so there is no public route
 * and no shared secret to configure or rotate. The console declares the binding
 * in its `wrangler.jsonc` and mirrors this contract in `GameServerClient`.
 *
 * `fetch` forwards an HTTP request to this Worker's public API. The console uses
 * it for the passkey flow, which must run against the game server (passkeys are
 * scoped to its domain) while the browser only talks to the console's origin.
 *
 * States that are normal for a fresh deployment (no version or configuration
 * stored yet) are returned instead of thrown, because RPC errors reach the
 * caller without the error code.
 */
export class ConsoleEntrypoint extends WorkerEntrypoint {
  /** Forwards a request to this Worker's public API (the default handler). */
  public async fetch(request: Request): Promise<Response> {
    return await getHTTPService().fetch(request);
  }

  public async getVersion(): Promise<GetVersionResponse> {
    try {
      return await getServices().version.get();
    } catch (error) {
      // An unstored version is a valid state, not a failure.
      if (
        error instanceof ServerError &&
        error.getCode() === "MISSING_VERSION"
      ) {
        return { minimumVersion: "" };
      }

      throw error;
    }
  }

  public async setVersion(params: unknown): Promise<void> {
    await getServices().version.set(this.parse(VersionSchema, params));
  }

  public async getConfiguration(): Promise<GetConfigurationResponse> {
    try {
      return await getServices().configuration.getData();
    } catch (error) {
      // Same as the version: an unstored configuration is not a failure.
      if (
        error instanceof ServerError &&
        error.getCode() === "CONFIGURATION_NOT_FOUND"
      ) {
        return {};
      }

      throw error;
    }
  }

  public async setConfiguration(params: unknown): Promise<void> {
    const { configuration } = this.parse(
      z.object({ configuration: ConfigurationSchema }),
      params,
    );

    await getServices().configuration.setData(configuration);
  }

  /** Replaces the serialized anti-cheat blob and broadcasts it to clients. */
  public async setAntiCheatConfig(params: unknown): Promise<void> {
    const { rules } = this.parse(AntiCheatConfigSchema, params);

    await getServices().configuration.setAntiCheatConfigBlob(rules);
  }

  public async pushNotification(params: unknown): Promise<void> {
    const { channelName, text } = this.parse(NotificationSchema, params);

    await getServices().notification.notify(
      NotificationChannelNameToType[channelName],
      text,
    );
  }

  public async pushUserNotification(params: unknown): Promise<void> {
    const { channelName, userId, text } = this.parse(
      UserNotificationSchema,
      params,
    );

    await getServices().notification.notifyUser(
      NotificationChannelNameToType[channelName],
      userId,
      text,
    );
  }

  public async kickPlayer(params: unknown): Promise<void> {
    const { userId } = this.parse(UserSchema, params);

    await env.WEBSOCKET_DURABLE_OBJECT.getByName(
      WEBSOCKET_DURABLE_OBJECT_NAME,
    ).kickPlayer(userId);
  }

  public async refreshBlockedWords(): Promise<void> {
    await env.WEBSOCKET_DURABLE_OBJECT.getByName(
      WEBSOCKET_DURABLE_OBJECT_NAME,
    ).refreshBlockedWords();
  }

  /**
   * Arguments arrive from another Worker, so they are validated here as well:
   * a caller running an older build must not be able to write invalid state.
   */
  private parse<TSchema extends z.ZodType>(
    schema: TSchema,
    value: unknown,
  ): z.infer<TSchema> {
    const result = schema.safeParse(value);

    if (!result.success) {
      throw new ServerError(
        "INVALID_CONSOLE_REQUEST",
        result.error.issues[0]?.message ?? "Invalid request",
        400,
      );
    }

    return result.data;
  }
}
