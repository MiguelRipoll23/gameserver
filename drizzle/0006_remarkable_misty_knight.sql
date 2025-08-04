ALTER TABLE "server_messages" ADD COLUMN "updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_unique" UNIQUE("user_id");