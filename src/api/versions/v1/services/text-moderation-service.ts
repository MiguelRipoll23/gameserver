import { inject, injectable } from "@needle-di/core";
import { Logger } from "../../../../core/utils/logger.ts";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { ServerError } from "../models/server-error.ts";
import { and, asc, eq, gt, like } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { blockedWordsTable } from "../../../../db/schema.ts";
import {
  type BlockedWordEntity,
  type BlockedWordInsertEntity,
} from "../../../../db/tables/blocked-words-table.ts";
import {
  BlockWordRequest,
  GetBlockedWordsRequest,
  GetBlockedWordsResponse,
  UpdateWordRequest,
} from "../schemas/text-moderation-schemas.ts";
import { getHubStub } from "../../../../core/utils/environment.ts";

@injectable()
export class TextModerationService {
  constructor(
    private databaseService = inject(DatabaseService),
  ) {}

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
      Logger.error("Database error while blocking word:", error);
      throw new ServerError("DATABASE_ERROR", "Failed to block word", 500);
    }

    this.dispatchRefreshCacheEvent();
  }

  public async getBlockedWords(
    body: GetBlockedWordsRequest,
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
      const finalQuery = conditions.length > 0
        ? query.where(
          conditions.length === 1 ? conditions[0] : and(...conditions),
        )
        : query;

      // Get one extra item to check if there are more results
      const results = await finalQuery.limit(limit + 1);

      const hasMore = results.length > limit;
      const data = hasMore ? results.slice(0, limit) : results;
      const nextCursor = hasMore && data.length > 0
        ? data[data.length - 1].id
        : undefined;

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
      Logger.error("Database error while fetching blocked words:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to fetch blocked words",
        500,
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
      Logger.error("Database error while unblocking word:", error);
      throw new ServerError("DATABASE_ERROR", "Failed to unblock word", 500);
    }

    this.dispatchRefreshCacheEvent();
  }

  public async updateWord(
    wordId: number,
    body: UpdateWordRequest,
  ): Promise<void> {
    const { word, notes } = body;
    const db = this.databaseService.get();

    try {
      await db.transaction(async (tx) => {
        // Check the blocked word exists by id
        const existing = await tx
          .select()
          .from(blockedWordsTable)
          .where(eq(blockedWordsTable.id, wordId))
          .limit(1);

        if (existing.length === 0) {
          throw new ServerError(
            "WORD_NOT_FOUND",
            `Blocked word with id ${wordId} does not exist`,
            404,
          );
        }

        const updateData: Partial<BlockedWordInsertEntity> = {
          updatedAt: new Date(),
        };

        // Update the word text when provided, ensuring the new value is not
        // already blocked under a different entry
        if (word !== undefined) {
          const normalizedNewWord = this.normalizeWord(word);

          if (normalizedNewWord !== existing[0].word) {
            await this.checkWordNotBlocked(tx, normalizedNewWord, word);
          }

          updateData.word = normalizedNewWord;
        }

        // Omit keeps the current notes, null clears them
        if (notes !== undefined) {
          updateData.notes = notes;
        }

        await tx
          .update(blockedWordsTable)
          .set(updateData)
          .where(eq(blockedWordsTable.id, wordId));
      });
    } catch (error) {
      if (error instanceof ServerError) {
        throw error;
      }
      Logger.error("Database error while updating word:", error);
      throw new ServerError("DATABASE_ERROR", "Failed to update word", 500);
    }

    this.dispatchRefreshCacheEvent();
  }

  public async getAllBlockedWords(): Promise<BlockedWordEntity[]> {
    const db = this.databaseService.get();

    try {
      return await db.select().from(blockedWordsTable);
    } catch (error) {
      Logger.error("Database error while fetching blocked words:", error);
      throw new ServerError(
        "DATABASE_ERROR",
        "Failed to fetch blocked words",
        500,
      );
    }
  }

  private normalizeWord(word: string): string {
    return word.trim().toLowerCase().normalize("NFKC"); // Unicode normalization to handle homoglyphs
  }

  private async checkWordIsBlocked(
    tx: NodePgDatabase,
    normalizedWord: string,
    originalWord: string,
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
        404,
      );
    }
  }

  private async checkWordNotBlocked(
    tx: NodePgDatabase,
    normalizedWord: string,
    originalWord: string,
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
        409,
      );
    }
  }

  private dispatchRefreshCacheEvent(): void {
    void getHubStub().refreshBlockedWords();
  }
}
