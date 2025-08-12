import { inject, injectable } from "@needle-di/core";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { ServerError } from "../models/server-error.ts";
import { eq, like, gt, asc, and } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { blockedWordsTable } from "../../../../db/schema.ts";
import {
  type BlockedWordEntity,
  type BlockedWordInsertEntity,
} from "../../../../db/tables/blocked-words-table.ts";
import {
  BlockWordRequest,
  GetBlockedWordsRequest,
  UpdateWordRequest,
  GetBlockedWordsResponse,
} from "../schemas/text-moderation-schemas.ts";
import { REFRESH_BLOCKED_WORDS_CACHE } from "../constants/event-constants.ts";

@injectable()
export class TextModerationService {
  constructor(private databaseService = inject(DatabaseService)) {}

  public async blockWord(body: BlockWordRequest): Promise<void> {
    const { word, notes } = body;
    const normalizedWord = this.normalizeWord(word);
    const db = this.databaseService.get();

    try {
      await db.transaction(async (tx) => {
        // Check if word is already blocked using normalized word
        await this.checkWordNotBlocked(tx, normalizedWord, word);

        // Insert the new blocked word with normalized value
        const insertData: BlockedWordInsertEntity = {
          word: normalizedWord,
          notes,
          updatedAt: new Date(),
        };

        await tx.insert(blockedWordsTable).values(insertData);
      });
    } catch (error) {
      if (error instanceof ServerError) {
        throw error;
      }
      console.error("Database error while blocking word:", error);
      throw new ServerError("DATABASE_ERROR", "Failed to block word", 500);
    }

    this.dispatchRefreshCacheEvent();
  }

  public async getBlockedWords(
    body: GetBlockedWordsRequest
  ): Promise<GetBlockedWordsResponse> {
    const { cursor, limit = 20, word } = body;
    const db = this.databaseService.get();

    try {
      // Build where conditions
      const conditions = [];

      // Apply cursor-based pagination
      if (cursor) {
        conditions.push(gt(blockedWordsTable.id, cursor));
      }

      // Apply word filter if provided
      if (word) {
        const normalizedFilter = this.normalizeWord(word);
        conditions.push(like(blockedWordsTable.word, `%${normalizedFilter}%`));
      }

      // Build the query with all conditions at once
      const query = db
        .select()
        .from(blockedWordsTable)
        .orderBy(asc(blockedWordsTable.id));

      // Apply conditions if any exist
      const finalQuery =
        conditions.length > 0
          ? query.where(
              conditions.length === 1 ? conditions[0] : and(...conditions)
            )
          : query;

      // Get one extra item to check if there are more results
      const results = await finalQuery.limit(limit + 1);

      const hasMore = results.length > limit;
      const data = hasMore ? results.slice(0, limit) : results;
      const nextCursor =
        hasMore && data.length > 0 ? data[data.length - 1].id : undefined;

      return {
        results: data.map((item) => ({
          id: item.id,
          word: item.word,
          notes: item.notes,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt?.toISOString() || null,
        })),
        nextCursor,
        hasMore,
      };
    } catch (error) {
      console.error("Database error while fetching blocked words:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to fetch blocked words",
        500
      );
    }
  }

  public async unblockWord(body: { word: string }): Promise<void> {
    const { word } = body;
    const normalizedWord = this.normalizeWord(word);
    const db = this.databaseService.get();

    try {
      await db.transaction(async (tx) => {
        // Check if word exists and is blocked using normalized word
        await this.checkWordIsBlocked(tx, normalizedWord, word);

        // Delete the blocked word using normalized word
        await tx
          .delete(blockedWordsTable)
          .where(eq(blockedWordsTable.word, normalizedWord));
      });
    } catch (error) {
      if (error instanceof ServerError) {
        throw error;
      }
      console.error("Database error while unblocking word:", error);
      throw new ServerError("DATABASE_ERROR", "Failed to unblock word", 500);
    }

    this.dispatchRefreshCacheEvent();
  }

  public async updateWord(body: UpdateWordRequest): Promise<void> {
    const { word, newWord, notes } = body;
    const normalizedCurrentWord = this.normalizeWord(word);
    const normalizedNewWord = this.normalizeWord(newWord);
    const db = this.databaseService.get();

    try {
      await db.transaction(async (tx) => {
        // Check if the current word exists and is blocked
        await this.checkWordIsBlocked(tx, normalizedCurrentWord, word);

        // If the new word is different from the current word, check if it already exists
        if (normalizedCurrentWord !== normalizedNewWord) {
          await this.checkWordNotBlocked(tx, normalizedNewWord, newWord);
        }

        // Update the blocked word
        await tx
          .update(blockedWordsTable)
          .set({
            word: normalizedNewWord,
            notes,
            updatedAt: new Date(),
          })
          .where(eq(blockedWordsTable.word, normalizedCurrentWord));
      });
    } catch (error) {
      if (error instanceof ServerError) {
        throw error;
      }
      console.error("Database error while updating word:", error);
      throw new ServerError("DATABASE_ERROR", "Failed to update word", 500);
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

  private normalizeWord(word: string): string {
    return word.trim().toLowerCase().normalize("NFKC"); // Unicode normalization to handle homoglyphs
  }

  private async checkWordIsBlocked(
    tx: NodePgDatabase,
    normalizedWord: string,
    originalWord: string
  ): Promise<void> {
    const existingWord = await tx
      .select()
      .from(blockedWordsTable)
      .where(eq(blockedWordsTable.word, normalizedWord))
      .limit(1);

    if (existingWord.length === 0) {
      throw new ServerError(
        "WORD_NOT_BLOCKED",
        `Word "${originalWord}" is not currently blocked`,
        404
      );
    }
  }

  private async checkWordNotBlocked(
    tx: NodePgDatabase,
    normalizedWord: string,
    originalWord: string
  ): Promise<void> {
    const existingWord = await tx
      .select()
      .from(blockedWordsTable)
      .where(eq(blockedWordsTable.word, normalizedWord))
      .limit(1);

    if (existingWord.length > 0) {
      throw new ServerError(
        "WORD_ALREADY_BLOCKED",
        `Word "${originalWord}" is already blocked`,
        409
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
