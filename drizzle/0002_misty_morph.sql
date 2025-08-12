ALTER TABLE "blocked_words" DROP CONSTRAINT "blocked_words_word_unique";--> statement-breakpoint
ALTER TABLE "blocked_words" ALTER COLUMN "word" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "blocked_words" ALTER COLUMN "notes" SET DATA TYPE text;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_lower_word" ON "blocked_words" USING btree (lower("word"));