import { encodeBase64 } from "hono/utils/encode";
import { ServerError } from "../models/server-error.ts";
import { ServerSignatureKeysService } from "./server-signature-keys-service.ts";
import { inject, injectable } from "@needle-di/core";

@injectable()
export class SignatureService {
  private ALGORITHM: EcKeyImportParams & EcKeyGenParams = {
    name: "ECDSA",
    namedCurve: "P-256",
  };

  private privateKey: CryptoKey | null = null;
  private publicKey: CryptoKey | null = null;
  private encodedPublicKey: string | null = null;

  private initialized = false;
  private initializationPromise: Promise<void> | null = null;

  constructor(
    private serverSignatureKeysService = inject(ServerSignatureKeysService),
  ) { }

  public async getEncodedPublicKey(): Promise<string> {
    await this.ensureInitialized();
    if (this.encodedPublicKey === null) {
      throw new ServerError(
        "INVALID_SERVER_CONFIGURATION",
        "Signature public key not available",
        500,
      );
    }
    return this.encodedPublicKey;
  }

  public async signArrayBuffer(data: ArrayBuffer): Promise<ArrayBuffer> {
    await this.ensureInitialized();
    if (this.privateKey === null) {
      throw new ServerError(
        "INVALID_SERVER_CONFIGURATION",
        "Signature private key not available",
        500,
      );
    }
    return crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      this.privateKey,
      data,
    );
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    this.initializationPromise ??= this.initializeKeys().catch((error) => {
      // Allow retry on next call
      this.initializationPromise = null;
      throw error;
    });

    await this.initializationPromise;
  }

  private async initializeKeys(): Promise<void> {
    const didLoad = await this.tryLoadKeysFromStorage();
    if (!didLoad) await this.generateAndStoreKeys();
    this.initialized = true;
  }

  private async tryLoadKeysFromStorage(): Promise<boolean> {
    const saved = await this.serverSignatureKeysService.get();
    if (!saved) return false;

    this.privateKey = await this.importKey(saved.privateKey, "sign");
    this.publicKey = await this.importKey(saved.publicKey, "verify");
    this.encodedPublicKey = await this.encodePublicKey(this.publicKey);

    return true;
  }

  private async generateAndStoreKeys(): Promise<void> {
    const { privateKey, publicKey } = await crypto.subtle.generateKey(
      this.ALGORITHM,
      true,
      ["sign", "verify"],
    );

    this.privateKey = privateKey;
    this.publicKey = publicKey;
    this.encodedPublicKey = await this.encodePublicKey(publicKey);

    await this.serverSignatureKeysService.save({
      privateKey: await crypto.subtle.exportKey("jwk", privateKey),
      publicKey: await crypto.subtle.exportKey("jwk", publicKey),
    });
  }

  private async importKey(jwk: JsonWebKey, usage: "sign" | "verify"): Promise<CryptoKey> {
    try {
      return await crypto.subtle.importKey("jwk", jwk, this.ALGORITHM, true, [usage]);
    } catch (cause) {
      throw new ServerError(
        "INVALID_SERVER_CONFIGURATION",
        `Failed to import ${usage} key`,
        500,
      );
    }
  }

  private async encodePublicKey(key: CryptoKey): Promise<string> {
    const spki = await crypto.subtle.exportKey("spki", key);
    return encodeBase64(spki);
  }
}
