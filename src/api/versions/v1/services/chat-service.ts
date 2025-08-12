import { inject, injectable } from "@needle-di/core";
import { SignatureService } from "./signature-service.ts";
import { TextModerationService } from "./text-moderation-service.ts";
import { WebSocketServer } from "../interfaces/websocket-server-interface.ts";
import { WebSocketUser } from "../models/websocket-user.ts";
import { BinaryReader } from "../../../../core/utils/binary-reader-utils.ts";
import { BinaryWriter } from "../../../../core/utils/binary-writer-utils.ts";
import { WebSocketType } from "../enums/websocket-enum.ts";
import { REFRESH_BLOCKED_WORDS_CACHE_CHANNEL } from "../constants/broadcast-channel-constants.ts";

@injectable()
export class ChatService {
  private static readonly MAX_CHAT_MESSAGE_LENGTH = 35;
  private censoredWords: string[] = [];
  private cacheInitialized = false;
  private broadcastChannel: BroadcastChannel;

  constructor(
    private readonly signatureService = inject(SignatureService),
    private readonly textModerationService = inject(TextModerationService)
  ) {
    // Set up broadcast channel to listen for cache update notifications
    this.broadcastChannel = new BroadcastChannel(
      REFRESH_BLOCKED_WORDS_CACHE_CHANNEL
    );
    this.broadcastChannel.addEventListener(
      "message",
      this.handleCacheUpdateMessage.bind(this)
    );
  }

  private handleCacheUpdateMessage(): void {
    console.log("Received broadcast message to refresh blocked words cache");
    this.refreshBlockedWordsCache();
  }

  private async loadCensoredWords(): Promise<void> {
    try {
      const blockedWords =
        await this.textModerationService.getAllBlockedWords();
      this.censoredWords = blockedWords
        .map((blockedWord) =>
          this.validateAndSanitizeBlockWord(blockedWord.word)
        )
        .filter((word): word is string => !!word);
      this.cacheInitialized = true;
      console.log(
        `Loaded ${this.censoredWords.length} blocked words into cache`
      );
    } catch (error) {
      console.error("Failed to load censored words from database:", error);
      this.censoredWords = [];
      this.cacheInitialized = false;
    }
  }

  public async refreshBlockedWordsCache(): Promise<void> {
    console.log("Refreshing blocked words cache...");
    await this.loadCensoredWords();

    // Broadcast to other servers to refresh their cache
    const broadcastChannel = new BroadcastChannel(
      REFRESH_BLOCKED_WORDS_CACHE_CHANNEL
    );
    broadcastChannel.postMessage(null);
    broadcastChannel.close();
  }

  private async ensureCacheInitialized(): Promise<void> {
    if (!this.cacheInitialized) {
      await this.loadCensoredWords();
    }
  }

  public async sendSignedChatMessage(
    webSocketServer: WebSocketServer,
    user: WebSocketUser,
    reader: BinaryReader
  ): Promise<void> {
    // Ensure cache is initialized before processing message
    await this.ensureCacheInitialized();

    const unfilteredMessageText = reader.variableLengthString().trim();

    if (!this.isValidMessage(unfilteredMessageText, user)) return;

    console.log(
      `Received chat message to sign from user ${user.getName()} with text: ${unfilteredMessageText}`
    );

    const userId = user.getNetworkId();
    const filteredMessageText = this.filterMessageText(unfilteredMessageText);
    const timestampSeconds = Math.floor(Date.now() / 1000);
    const signaturePayload = BinaryWriter.build()
      .fixedLengthString(userId, 32)
      .variableLengthString(filteredMessageText)
      .unsignedInt32(timestampSeconds)
      .toArrayBuffer();

    const signedPayload = await this.getSignedPayload(signaturePayload);

    if (signedPayload === null) {
      console.warn(`Failed to sign chat message from ${user.getName()}:`);
      return;
    }

    const chatMessagePayload = BinaryWriter.build()
      .unsignedInt8(WebSocketType.ChatMessage)
      .arrayBuffer(signaturePayload)
      .arrayBuffer(signedPayload)
      .toArrayBuffer();

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

  private filterMessageText(text: string): string {
    const textLower = this.toAsciiLowerCase(text);
    const textArray = [...text]; // Convert to character array for safe modification

    for (const word of this.censoredWords) {
      const wordLower = this.toAsciiLowerCase(word);
      let searchIndex = 0;

      while (searchIndex < textLower.length) {
        const foundIndex = textLower.indexOf(wordLower, searchIndex);
        if (foundIndex === -1) break;

        // Check word boundaries manually for safety
        const isWordStart =
          foundIndex === 0 ||
          this.isWordBoundary(textLower.charAt(foundIndex - 1));
        const isWordEnd =
          foundIndex + wordLower.length >= textLower.length ||
          this.isWordBoundary(textLower.charAt(foundIndex + wordLower.length));

        if (isWordStart && isWordEnd) {
          // Replace characters with asterisks
          for (let i = 0; i < wordLower.length; i++) {
            textArray[foundIndex + i] = "*";
          }
        }

        searchIndex = foundIndex + 1;
      }
    }

    return textArray.join("");
  }

  private validateAndSanitizeBlockWord(word: string): string | null {
    // Validate word: only allow alphanumeric characters and basic punctuation
    if (typeof word !== "string" || word.length === 0 || word.length > 50) {
      return null;
    }

    // Only allow safe characters: letters, numbers, spaces, hyphens, apostrophes
    const safePattern = /^[a-zA-Z0-9\s\-']+$/;
    if (!safePattern.test(word)) {
      return null;
    }

    return word.trim();
  }

  private isWordBoundary(char: string): boolean {
    // Define word boundary characters (non-alphanumeric)
    return !/[a-zA-Z0-9]/.test(char);
  }

  private async getSignedPayload(
    signaturePayload: ArrayBuffer
  ): Promise<ArrayBuffer | null> {
    let signedPayload: ArrayBuffer | null = null;

    try {
      signedPayload = await this.signatureService.signArrayBuffer(
        signaturePayload
      );
    } catch (error) {
      console.error(error);
    }

    return signedPayload;
  }

  private toAsciiLowerCase(text: string): string {
    return text.replace(/[A-Z]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) + 32)
    );
  }
}
