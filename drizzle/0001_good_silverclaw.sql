ALTER TABLE "userSessions" RENAME TO "user_sessions";--> statement-breakpoint
ALTER TABLE "matches" DROP CONSTRAINT "matches_session_id_userSessions_id_fk";
--> statement-breakpoint
ALTER TABLE "user_sessions" DROP CONSTRAINT "userSessions_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_session_id_user_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."user_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;