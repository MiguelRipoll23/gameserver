ALTER TABLE "user_reports" ALTER COLUMN "reason" SET DATA TYPE varchar(500);--> statement-breakpoint
ALTER TABLE "user_credentials" DROP COLUMN "user_display_name";--> statement-breakpoint
ALTER TABLE "user_scores" DROP COLUMN "user_display_name";