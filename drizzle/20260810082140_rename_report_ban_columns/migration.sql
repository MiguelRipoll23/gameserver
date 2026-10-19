ALTER TABLE "user_reports" RENAME COLUMN "reporter_user_id" TO "issued_by_user_id";--> statement-breakpoint
ALTER TABLE "user_reports" RENAME COLUMN "reported_user_id" TO "user_id";--> statement-breakpoint
ALTER TABLE "user_bans" RENAME COLUMN "issued_by" TO "issued_by_user_id";--> statement-breakpoint
ALTER TABLE "user_reports" RENAME CONSTRAINT "user_reports_reporter_user_id_users_id_fkey" TO "user_reports_issued_by_user_id_users_id_fkey";--> statement-breakpoint
ALTER TABLE "user_reports" RENAME CONSTRAINT "user_reports_reported_user_id_users_id_fkey" TO "user_reports_user_id_users_id_fkey";--> statement-breakpoint
ALTER TABLE "user_bans" RENAME CONSTRAINT "user_bans_issued_by_users_id_fkey" TO "user_bans_issued_by_user_id_users_id_fkey";
