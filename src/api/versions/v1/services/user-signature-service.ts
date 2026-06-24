import { inject, injectable } from "@needle-di/core";
import { SignatureService } from "./signature-service.ts";
import { BinaryWriter } from "../../../../core/utils/binary-writer-utils.ts";

@injectable()
export class UserSignatureService {
  constructor(private signatureService = inject(SignatureService)) {}

  public async get(
    token: string,
    networkId: string,
    userName: string,
  ): Promise<ArrayBuffer> {
    const tokenBytes = new Uint8Array(Buffer.from(token, "base64"));
    const signaturePayload = BinaryWriter.build()
      .bytes(tokenBytes, 32)
      .fixedLengthString(networkId, 32)
      .fixedLengthString(userName, 16)
      .toArrayBuffer();

    const signedPayload =
      await this.signatureService.signArrayBuffer(signaturePayload);

    return signedPayload;
  }
}
