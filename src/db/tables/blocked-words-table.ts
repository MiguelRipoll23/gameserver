import { integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const blockedWordsTable = pgTable("blocked_words", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  word: varchar("word", { length: 100 }).notNull().unique(),
  notes: varchar("notes", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export type BlockedWordEntity = typeof blockedWordsTable.$inferSelect;
export type BlockedWordInsertEntity = typeof blockedWordsTable.$inferInsert;
