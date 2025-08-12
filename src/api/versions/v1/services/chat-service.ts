import { inject, injectable } from "@needle-di/core";
import { SignatureService } from "./signature-service.ts";
import { TextModerationService } from "./text-moderation-service.ts";
import { WebSocketServer } from "../interfaces/websocket-server-interface.ts";
import { WebSocketUser } from "../models/websocket-user.ts";
import { BinaryReader } from "../../../../core/utils/binary-reader-utils.ts";
import { BinaryWriter } from "../../../../core/utils/binary-writer-utils.ts";
import { WebSocketType } from "../enums/websocket-enum.ts";
import { REFRESH_BLOCKED_WORDS_CACHE_BROADCAST_CHANNEL } from "../constants/broadcast-channel-constants.ts";
import { REFRESH_BLOCKED_WORDS_CACHE } from "../constants/event-constants.ts";
import { BlockedWordEntity } from "../../../../db/tables/blocked-words-table.ts";

@injectable()
export class ChatService {
  private static readonly MAX_CHAT_MESSAGE_LENGTH = 35;
  private blockedWords: string[] = [];
  private cacheInitialized = false;
  private initializationPromise: Promise<void> | null = null;
  private refreshBlockedWordsCacheBroadcastChannel: BroadcastChannel;

  constructor(
    private readonly signatureService = inject(SignatureService),
    private readonly textModerationService = inject(TextModerationService)
  ) {
    this.refreshBlockedWordsCacheBroadcastChannel = new BroadcastChannel(
      REFRESH_BLOCKED_WORDS_CACHE_BROADCAST_CHANNEL
    );
    this.addEventListeners();
    this.addBroadcastChannelListeners();
  }

  private addEventListeners(): void {
    addEventListener(REFRESH_BLOCKED_WORDS_CACHE, (): void => {
      this.refreshBlockedWordsCache();
    });
  }

  private addBroadcastChannelListeners(): void {
    this.refreshBlockedWordsCacheBroadcastChannel.addEventListener(
      "message",
      this.refreshBlockedWordsCache.bind(this)
    );
  }

  private async refreshBlockedWordsCache(): Promise<void> {
    console.log("Refreshing blocked words cache...");

    try {
      const blockedWords =
        await this.textModerationService.getAllBlockedWords();
      this.blockedWords = this.validateBlockedWordsFromDatabase(blockedWords);
      this.cacheInitialized = true;
      console.log(
        `Loaded ${this.blockedWords.length} blocked words into cache`
      );
    } catch (error) {
      console.error("Failed to load censored words from database:", error);
      this.blockedWords = [];
      this.cacheInitialized = false;
    }

    this.refreshBlockedWordsCacheBroadcastChannel.postMessage(null);
  }

  private async ensureCacheInitialized(): Promise<void> {
    if (this.cacheInitialized) {
      return;
    }

    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }

    this.initializationPromise = (async () => {
      try {
        await this.refreshBlockedWordsCache();
        this.cacheInitialized = true;
      } finally {
        this.initializationPromise = null;
      }
    })();

    await this.initializationPromise;
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

    for (const word of this.blockedWords) {
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

  private validateBlockedWordsFromDatabase(blockedWords: BlockedWordEntity[]): string[] {
    const validWords: string[] = [];
    let invalidCount = 0;

    for (const blockedWord of blockedWords) {
      const validatedWord = this.validateAndSanitizeBlockWord(blockedWord.word);
      
      if (validatedWord) {
        validWords.push(validatedWord);
      } else {
        invalidCount++;
        console.warn(
          `Invalid blocked word found in database: "${blockedWord.word}" (ID: ${blockedWord.id}). ` +
          `Word does not meet validation criteria and will be skipped. ` +
          `Consider removing this word from the database or updating it to meet validation requirements.`
        );
      }
    }

    if (invalidCount > 0) {
      console.warn(
        `Total of ${invalidCount} invalid blocked words were skipped during cache refresh. ` +
        `These words exist in the database but do not meet validation criteria.`
      );
    }

    return validWords;
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
