ALTER TABLE "user_reports" RENAME COLUMN "user_id" TO "reported_user_id";--> statement-breakpoint
ALTER TABLE "user_scores" RENAME COLUMN "id" TO "user_id";--> statement-breakpoint
ALTER TABLE "user_reports" DROP CONSTRAINT "user_reports_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "user_scores" DROP CONSTRAINT "user_scores_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "user_bans" ADD COLUMN "reason" varchar(500) NOT NULL;--> statement-breakpoint
ALTER TABLE "user_reports" ADD COLUMN "reporter_user_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reported_user_id_users_id_fk" FOREIGN KEY ("reported_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_scores" ADD CONSTRAINT "user_scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;