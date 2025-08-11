import { inject, injectable } from "@needle-di/core";
import { SignatureService } from "./signature-service.ts";
import { WebSocketServer } from "../interfaces/websocket-server-interface.ts";
import { WebSocketUser } from "../models/websocket-user.ts";
import { BinaryReader } from "../../../../core/utils/binary-reader-utils.ts";
import { BinaryWriter } from "../../../../core/utils/binary-writer-utils.ts";
import { WebSocketType } from "../enums/websocket-enum.ts";
import blockWords from "../data/block-words.json" with { type: "json" };

@injectable()
export class ChatService {
  private static readonly MAX_CHAT_MESSAGE_LENGTH = 35;

  constructor(private readonly signatureService = inject(SignatureService)) {}

  public async sendSignedChatMessage(
    webSocketServer: WebSocketServer,
    user: WebSocketUser,
    reader: BinaryReader
  ): Promise<void> {
    const unfilteredMessageText = reader.variableLengthString().trim();

    if (!this.isValidMessage(unfilteredMessageText, user)) return;

    console.log(`Receiving chat message to sign from user ${user.getName()} with text: ${unfilteredMessageText}`);

    const filteredMessage = this.filterMessageText(unfilteredMessageText);
    const timestamp = Date.now();
    const originUserId = user.getNetworkId();

    const signaturePayload = this.buildSignaturePayload(
      originUserId,
      filteredMessage,
      timestamp
    );

    let signedPayload: ArrayBuffer;

    try {
      signedPayload = await this.signatureService.signArrayBuffer(
        signaturePayload
      );
    } catch (error) {
      console.error(`Failed to sign chat message from ${user.getName()}:`, error);
      return;
    }

    const chatMessagePayload = this.buildChatMessagePayload(signedPayload);

    webSocketServer.sendMessage(user, chatMessagePayload);
  }

  private isValidMessage(message: string, user: WebSocketUser): boolean {
    return (
      this.isNotEmpty(message, user) && this.isWithinMaxLength(message, user)
    );
  }

  private isNotEmpty(message: string, user: WebSocketUser): boolean {
    if (!message) {
      console.warn(
        `Rejected chat message from ${user.getName()} because it is empty`
      );
      return false;
    }
    return true;
  }

  private isWithinMaxLength(message: string, user: WebSocketUser): boolean {
    if (message.length > ChatService.MAX_CHAT_MESSAGE_LENGTH) {
      console.warn(
        `Rejected chat message from ${user.getName()} because it exceeds the limit of ${
          ChatService.MAX_CHAT_MESSAGE_LENGTH
        } characters`
      );
      return false;
    }
    return true;
  }

  private buildSignaturePayload(
    userId: string,
    message: string,
    timestamp: number
  ): ArrayBuffer {
    return BinaryWriter.build()
      .fixedLengthString(userId, 32)
      .variableLengthString(message)
      .unsignedInt32(timestamp)
      .toArrayBuffer();
  }

  private buildChatMessagePayload(signedPayload: ArrayBuffer): ArrayBuffer {
    return BinaryWriter.build()
      .unsignedInt8(WebSocketType.ChatMessage)
      .arrayBuffer(signedPayload)
      .toArrayBuffer();
  }

  private filterMessageText(text: string): string {
    let filteredText = text;

    for (const word of blockWords) {
      const regex = new RegExp(`\\b${ChatService.escapeRegExp(word)}\\b`, "gi");
      filteredText = filteredText.replace(regex, (matched) =>
        "*".repeat(matched.length)
      );
    }

    return filteredText;
  }

  private static escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
