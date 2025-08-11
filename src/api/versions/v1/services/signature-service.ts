import { encodeBase64 } from "hono/utils/encode";
import { ServerError } from "../models/server-error.ts";
import { KVService } from "./kv-service.ts";
import { inject, injectable } from "@needle-di/core";

@injectable()
export class SignatureService {
  private static readonly ALGORITHM_NAME = "ECDSA";
  private static readonly NAMED_CURVE = "P-256";
  private static readonly SIGN_USAGE: KeyUsage = "sign";
  private static readonly VERIFY_USAGE: KeyUsage = "verify";
  private static readonly SIGN_VERIFY_USAGES: KeyUsage[] = ["sign", "verify"];
  private static readonly SIGN_HASH = "SHA-256";

  private privateKey: CryptoKey | null = null;
  private publicKey: CryptoKey | null = null;

  private encodedPublicKey: string | null = null;

  constructor(private kvService = inject(KVService)) {}

  /**
   * Initialize the service by loading keys from storage or generating new ones.
   * Must be called before using the service.
   */
  public async init(): Promise<void> {
    // Try to load keys from storage
    const loaded = await this.loadKeysFromStorage();

    if (loaded) {
      // Cache encoded public key after loading
      const publicKey = this.getPublicKey();
      this.encodedPublicKey = await this.exportPublicKeyToBase64(publicKey);
      return;
    }

    // If not loaded, generate and store keys
    await this.generateAndStoreKeys();

    // Cache encoded public key after generation
    const publicKey = this.getPublicKey();
    this.encodedPublicKey = await this.exportPublicKeyToBase64(publicKey);
  }

  public getEncodedPublicKey(): string {
    if (this.encodedPublicKey === null) {
      throw new ServerError(
        "INVALID_SERVER_CONFIGURATION",
        "Signature public key not generated",
        500
      );
    }

    return this.encodedPublicKey;
  }

  public signArrayBuffer(data: ArrayBuffer): Promise<ArrayBuffer> {
    const privateKey = this.getPrivateKey();

    return crypto.subtle.sign(
      {
        name: SignatureService.ALGORITHM_NAME,
        hash: { name: SignatureService.SIGN_HASH },
      },
      privateKey,
      data
    );
  }

  private getPrivateKey(): CryptoKey {
    if (!this.privateKey) {
      throw new ServerError(
        "INVALID_SERVER_CONFIGURATION",
        "Invalid server configuration",
        500
      );
    }

    return this.privateKey;
  }

  private getPublicKey(): CryptoKey {
    if (!this.publicKey) {
      throw new ServerError(
        "INVALID_SERVER_CONFIGURATION",
        "Invalid server configuration",
        500
      );
    }

    return this.publicKey;
  }

  private async exportPublicKeyToBase64(publicKey: CryptoKey): Promise<string> {
    // Export the public key as spki (SubjectPublicKeyInfo) format
    const spkiBuffer = await crypto.subtle.exportKey("spki", publicKey);

    // Convert ArrayBuffer to base64
    const base64 = encodeBase64(spkiBuffer);

    return base64;
  }

  private async importKey(
    jwk: JsonWebKey,
    usage: KeyUsage
  ): Promise<CryptoKey> {
    try {
      return await crypto.subtle.importKey(
        "jwk",
        jwk,
        {
          name: SignatureService.ALGORITHM_NAME,
          namedCurve: SignatureService.NAMED_CURVE,
        },
        true,
        [usage]
      );
    } catch {
      throw new ServerError(
        "INVALID_SERVER_CONFIGURATION",
        "Invalid server configuration",
        500
      );
    }
  }

  private exportKey(key: CryptoKey): Promise<JsonWebKey> {
    return crypto.subtle.exportKey("jwk", key);
  }

  private async loadKeysFromStorage(): Promise<boolean> {
    const savedKeys = await this.kvService.getSignatureKeys();
    if (!savedKeys) return false;

    this.privateKey = await this.importKey(
      savedKeys.privateKey,
      SignatureService.SIGN_USAGE
    );
    this.publicKey = await this.importKey(
      savedKeys.publicKey,
      SignatureService.VERIFY_USAGE
    );

    return true;
  }

  private async generateAndStoreKeys(): Promise<void> {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: SignatureService.ALGORITHM_NAME,
        namedCurve: SignatureService.NAMED_CURVE,
      },
      true,
      SignatureService.SIGN_VERIFY_USAGES
    );

    this.privateKey = keyPair.privateKey;
    this.publicKey = keyPair.publicKey;

    // Cache encoded public key here as well
    this.encodedPublicKey = await this.exportPublicKeyToBase64(this.publicKey);

    await this.kvService.setSignatureKeys({
      privateKey: await this.exportKey(this.privateKey),
      publicKey: await this.exportKey(this.publicKey),
    });
  }
}
