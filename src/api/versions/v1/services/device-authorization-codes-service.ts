import { inject, injectable } from "@needle-di/core";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { and, eq, gt, isNotNull, sql } from "drizzle-orm";
import { deviceAuthorizationCodesTable } from "../../../../db/schema.ts";
import { decodeBase64, encodeBase64 } from "@std/encoding/base64";
import { ServerError } from "../models/server-error.ts";
import { JWTService } from "../../../../core/services/jwt-service.ts";
import { DEVICE_AUTHORIZATION_CODE_EXPIRATION_MS } from "../constants/authentication-constants.ts";

const ENCRYPTION_IV_LENGTH = 12;
const CODE_LENGTH = 16;
const CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const REQUIRED_ROLE = "manager";

export interface DeviceAuthorizationTokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface DeviceAuthorizationCode {
  code: string;
  expiresAt: Date;
}

@injectable()
export class DeviceAuthorizationCodesService {
  private encryptionKey: CryptoKey | null = null;

  constructor(
    private databaseService = inject(DatabaseService),
    private jwtService = inject(JWTService),
  ) {}

  public async create(): Promise<DeviceAuthorizationCode> {
    const expiresAt = new Date(
      Date.now() + DEVICE_AUTHORIZATION_CODE_EXPIRATION_MS,
    );

    for (let attempt = 0; attempt < 3; attempt++) {
      const code = this.generateCode();

      const rows = await this.databaseService
        .get()
        .insert(deviceAuthorizationCodesTable)
        .values({ code, expiresAt })
        .onConflictDoNothing()
        .returning({ code: deviceAuthorizationCodesTable.code });

      if (rows.length > 0) {
        return { code, expiresAt };
      }
    }

    throw new ServerError(
      "DEVICE_AUTHORIZATION_CODE_CREATION_FAILED",
      "Failed to create device authorization code",
      500,
    );
  }

  public async save(
    code: string,
    accessToken: string,
    refreshToken: string,
  ): Promise<void> {
    const payload = await this.jwtService.verify(accessToken);
    const roles = this.normalizeRoles(payload.roles);

    if (!roles.includes(REQUIRED_ROLE)) {
      throw new ServerError(
        "NO_MANAGER_ROLE",
        "Missing manager role",
        403,
      );
    }

    const encryptedTokens = await this.encryptTokens({
      accessToken,
      refreshToken,
    });

    const rows = await this.databaseService
      .get()
      .update(deviceAuthorizationCodesTable)
      .set({ encryptedTokens })
      .where(
        and(
          eq(deviceAuthorizationCodesTable.code, code),
          gt(deviceAuthorizationCodesTable.expiresAt, sql`now()`),
        ),
      )
      .returning({ code: deviceAuthorizationCodesTable.code });

    if (rows.length === 0) {
      throw new ServerError(
        "DEVICE_AUTHORIZATION_CODE_NOT_FOUND",
        "Device authorization code not found or expired",
        404,
      );
    }
  }

  public async consume(
    code: string,
  ): Promise<DeviceAuthorizationTokenPair | null> {
    const rows = await this.databaseService
      .get()
      .delete(deviceAuthorizationCodesTable)
      .where(
        and(
          eq(deviceAuthorizationCodesTable.code, code),
          gt(deviceAuthorizationCodesTable.expiresAt, sql`now()`),
          isNotNull(deviceAuthorizationCodesTable.encryptedTokens),
        ),
      )
      .returning({
        encryptedTokens: deviceAuthorizationCodesTable.encryptedTokens,
        expiresAt: deviceAuthorizationCodesTable.expiresAt,
      });

    if (rows.length === 0) return null;

    const encryptedTokens = rows[0].encryptedTokens;

    if (encryptedTokens === null) return null;

    try {
      return await this.decryptTokens(encryptedTokens);
    } catch (error) {
      // Restore the row so a failed decrypt does not permanently burn the code
      await this.databaseService
        .get()
        .insert(deviceAuthorizationCodesTable)
        .values({
          code,
          encryptedTokens,
          expiresAt: rows[0].expiresAt,
        })
        .onConflictDoNothing();

      throw error;
    }
  }

  private normalizeRoles(roles: unknown): string[] {
    if (!Array.isArray(roles)) return [];

    return roles.filter((role): role is string => typeof role === "string");
  }

  private generateCode(): string {
    const randomBytes = new Uint8Array(CODE_LENGTH);
    const maxValid = 256 - (256 % CODE_ALPHABET.length);

    let code = "";

    while (code.length < CODE_LENGTH) {
      crypto.getRandomValues(randomBytes);

      for (const byte of randomBytes) {
        if (byte >= maxValid) continue;

        code += CODE_ALPHABET[byte % CODE_ALPHABET.length];

        if (code.length === CODE_LENGTH) break;
      }
    }

    return code;
  }

  private async getEncryptionKey(): Promise<CryptoKey> {
    if (this.encryptionKey !== null) return this.encryptionKey;

    const jwtSecret = Deno.env.get("JWT_SECRET");

    if (jwtSecret === undefined) {
      throw new ServerError(
        "BAD_SERVER_CONFIGURATION",
        "JWT_SECRET is not set in environment variables",
        500,
      );
    }

    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(jwtSecret),
      "HKDF",
      false,
      ["deriveKey"],
    );

    this.encryptionKey = await crypto.subtle.deriveKey(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: new TextEncoder().encode("device-authorization"),
        info: new TextEncoder().encode("device-authorization-tokens"),
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );

    return this.encryptionKey;
  }

  private async encryptTokens(
    pair: DeviceAuthorizationTokenPair,
  ): Promise<string> {
    const key = await this.getEncryptionKey();
    const iv = crypto.getRandomValues(new Uint8Array(ENCRYPTION_IV_LENGTH));
    const payload = new TextEncoder().encode(JSON.stringify(pair));

    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      payload,
    );

    const result = new Uint8Array(iv.length + ciphertext.byteLength);
    result.set(iv, 0);
    result.set(new Uint8Array(ciphertext), iv.length);

    return encodeBase64(result);
  }

  private async decryptTokens(
    encoded: string,
  ): Promise<DeviceAuthorizationTokenPair> {
    const key = await this.getEncryptionKey();
    const data = decodeBase64(encoded);

    if (data.byteLength <= ENCRYPTION_IV_LENGTH) {
      throw new ServerError(
        "INVALID_PAYLOAD",
        "Encrypted payload too short",
        400,
      );
    }

    const iv = data.subarray(0, ENCRYPTION_IV_LENGTH);
    const ciphertext = data.subarray(ENCRYPTION_IV_LENGTH);

    try {
      const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        ciphertext,
      );

      return JSON.parse(
        new TextDecoder().decode(plaintext),
      ) as DeviceAuthorizationTokenPair;
    } catch {
      throw new ServerError(
        "DECRYPT_FAILED",
        "Invalid or corrupted encrypted payload",
        400,
      );
    }
  }
}
