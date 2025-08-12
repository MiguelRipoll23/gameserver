import {
  integer,
  pgTable,
  timestamp,
  varchar,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const blockedWordsTable = pgTable(
  "blocked_words",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    word: varchar("word", { length: 255 }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => ({
    // Create a unique index on lower(word) for case-insensitive uniqueness
    uniqueLowerWord: uniqueIndex("unique_lower_word").on(
      sql`lower(${table.word})`
    ),
  })
);

export type BlockedWordEntity = typeof blockedWordsTable.$inferSelect;
export type BlockedWordInsertEntity = typeof blockedWordsTable.$inferInsert;
