import { inject, injectable } from "@needle-di/core";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { ServerError } from "../models/server-error.ts";
import { eq } from "drizzle-orm";
import {
  blockedWordsTable,
  type BlockedWordEntity,
  type BlockedWordInsertEntity,
} from "../../../../db/tables/blocked-words-table.ts";
import {
  BlockWordRequest,
  CheckWordRequest,
  UnblockWordRequest,
  WordBlockedResponse,
} from "../schemas/text-moderation-schemas.ts";
import { REFRESH_BLOCKED_WORDS_CACHE } from "../constants/event-constants.ts";

@injectable()
export class TextModerationService {
  constructor(private databaseService = inject(DatabaseService)) {}

  public async blockWord(body: BlockWordRequest): Promise<void> {
    const { word, notes } = body;
    const db = this.databaseService.get();

    try {
      // Check if word is already blocked
      const existingWord = await db
        .select()
        .from(blockedWordsTable)
        .where(eq(blockedWordsTable.word, word.toLowerCase()))
        .limit(1);

      if (existingWord.length > 0) {
        throw new ServerError(
          "WORD_ALREADY_BLOCKED",
          `Word "${word}" is already blocked`,
          409
        );
      }

      // Insert the new blocked word
      const insertData: BlockedWordInsertEntity = {
        word: word.toLowerCase(),
        notes,
        updatedAt: new Date(),
      };

      await db.insert(blockedWordsTable).values(insertData);
    } catch (error) {
      if (error instanceof ServerError) {
        throw error;
      }
      console.error("Database error while blocking word:", error);
      throw new ServerError("DATABASE_ERROR", "Failed to block word", 500);
    }

    this.dispatchRefreshCacheEvent();
  }

  public async isWordBlocked(
    body: CheckWordRequest
  ): Promise<WordBlockedResponse> {
    const { word } = body;
    const db = this.databaseService.get();

    try {
      const blockedWord = await db
        .select()
        .from(blockedWordsTable)
        .where(eq(blockedWordsTable.word, word.toLowerCase()))
        .limit(1);

      return {
        blocked: blockedWord.length > 0,
      };
    } catch (error) {
      console.error("Database error while checking word:", error);
      throw new ServerError("DATABASE_ERROR", "Failed to check word", 500);
    }
  }

  public async unblockWord(body: UnblockWordRequest): Promise<void> {
    const { word } = body;
    const db = this.databaseService.get();

    try {
      // Check if word exists and is blocked
      const existingWord = await db
        .select()
        .from(blockedWordsTable)
        .where(eq(blockedWordsTable.word, word.toLowerCase()))
        .limit(1);

      if (existingWord.length === 0) {
        throw new ServerError(
          "WORD_NOT_BLOCKED",
          `Word "${word}" is not currently blocked`,
          404
        );
      }

      // Delete the blocked word
      await db
        .delete(blockedWordsTable)
        .where(eq(blockedWordsTable.word, word.toLowerCase()));
    } catch (error) {
      if (error instanceof ServerError) {
        throw error;
      }
      console.error("Database error while unblocking word:", error);
      throw new ServerError("DATABASE_ERROR", "Failed to unblock word", 500);
    }

    this.dispatchRefreshCacheEvent();
  }

  public async getAllBlockedWords(): Promise<BlockedWordEntity[]> {
    const db = this.databaseService.get();

    try {
      return await db.select().from(blockedWordsTable);
    } catch (error) {
      console.error("Database error while fetching blocked words:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to fetch blocked words",
        500
      );
    }
  }

  private dispatchRefreshCacheEvent(): void {
    const customEvent = new CustomEvent(REFRESH_BLOCKED_WORDS_CACHE, {
      detail: {
        message: null,
      },
    });

    dispatchEvent(customEvent);
  }
}
