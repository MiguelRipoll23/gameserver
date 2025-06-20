import { inject, injectable } from "@needle-di/core";
import { ServerError } from "../../api/versions/v1/models/server-error.ts";
import { CryptoUtils } from "../utils/crypto-utils.ts";
import { KVService } from "./kv-service.ts";

@injectable()
export class CryptoService {
  constructor(private kvService = inject(KVService)) {}

  public async encryptForUser(
    userId: string,
    data: ArrayBuffer,
  ): Promise<ArrayBuffer> {
    const key: string | null = await this.kvService.getKey(userId);

    if (key === null) {
      throw new ServerError(
        "NO_SESSION_KEY",
        "No session found for this user",
        400,
      );
    }

    const cryptoKey: CryptoKey = await CryptoUtils.base64ToCryptoKey(
      key,
      {
        name: "AES-GCM",
        length: 256,
      },
      ["encrypt", "decrypt"],
    );

    return this.encryptData(cryptoKey, data);
  }

  public async decryptForUser(
    userId: string,
    encryptedData: ArrayBuffer,
  ): Promise<ArrayBuffer> {
    const key: string | null = await this.kvService.getKey(userId);

    if (key === null) {
      throw new ServerError(
        "NO_SESSION_KEY",
        "No session found for this user",
        400,
      );
    }

    const cryptoKey: CryptoKey = await CryptoUtils.base64ToCryptoKey(
      key,
      {
        name: "AES-GCM",
        length: 256,
      },
      ["encrypt", "decrypt"],
    );

    return this.decryptData(cryptoKey, encryptedData);
  }

  private async encryptData(
    cryptoKey: CryptoKey,
    data: ArrayBuffer,
  ): Promise<ArrayBuffer> {
    const iv = crypto.getRandomValues(new Uint8Array(12)); // IV remains Uint8Array

    // Encrypt the data using the cryptoKey
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
      },
      cryptoKey,
      data,
    );

    // Combine IV and encrypted data into a single ArrayBuffer
    const result = new Uint8Array(iv.length + encryptedData.byteLength);
    result.set(iv, 0); // Copy IV to the beginning
    result.set(new Uint8Array(encryptedData), iv.length); // Append encrypted data

    return result.buffer;
  }

  private async decryptData(
    cryptoKey: CryptoKey,
    encryptedData: ArrayBuffer,
  ): Promise<ArrayBuffer> {
    const encryptedArray = new Uint8Array(encryptedData);

    // Extract IV (first 12 bytes) and encrypted data
    const iv = encryptedArray.slice(0, 12);
    const data = encryptedArray.slice(12);

    // Decrypt the data using the cryptoKey
    const decryptedData = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
      },
      cryptoKey,
      data,
    );

    return decryptedData;
  }
}
