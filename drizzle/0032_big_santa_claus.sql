CREATE ROLE "authenticated_user";--> statement-breakpoint
CREATE TABLE "match_users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "match_users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"match_id" integer NOT NULL,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_bans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_credentials" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "matches" RENAME COLUMN "version" TO "client_version";--> statement-breakpoint
/* 
    Unfortunately in current drizzle-kit version we can't automatically get name for primary key.
    We are working on making it available!

    Meanwhile you can:
        1. Check pk name in your database, by running
            SELECT constraint_name FROM information_schema.table_constraints
            WHERE table_schema = 'public'
                AND table_name = 'user_scores'
                AND constraint_type = 'PRIMARY KEY';
        2. Uncomment code below and paste pk name manually
        
    Hope to release this update as soon as possible
*/

-- ALTER TABLE "user_scores" DROP CONSTRAINT "<constraint_name>";--> statement-breakpoint
ALTER TABLE "user_scores" ADD COLUMN "id" integer PRIMARY KEY NOT NULL GENERATED ALWAYS AS IDENTITY (sequence name "user_scores_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "match_users" ADD CONSTRAINT "match_users_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_users" ADD CONSTRAINT "match_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_scores" ADD CONSTRAINT "user_scores_user_id_unique" UNIQUE("user_id");--> statement-breakpoint
CREATE POLICY "user_bans_select_own" ON "user_bans" AS PERMISSIVE FOR SELECT TO "authenticated_user" USING ((current_setting('app.user_id', true)::uuid = "user_bans"."user_id"));--> statement-breakpoint
CREATE POLICY "user_credentials_select_own" ON "user_credentials" AS PERMISSIVE FOR SELECT TO "authenticated_user" USING ((current_setting('app.user_id', true)::uuid = "user_credentials"."user_id"));--> statement-breakpoint
CREATE POLICY "user_credentials_select_by_credential" ON "user_credentials" AS PERMISSIVE FOR SELECT TO "authenticated_user" USING ((current_setting('app.credential_id', true) = "user_credentials"."id"));--> statement-breakpoint
CREATE POLICY "user_credentials_insert_own" ON "user_credentials" AS PERMISSIVE FOR INSERT TO "authenticated_user" WITH CHECK ((current_setting('app.user_id', true)::uuid = "user_credentials"."user_id"));--> statement-breakpoint
CREATE POLICY "user_credentials_update_own" ON "user_credentials" AS PERMISSIVE FOR UPDATE TO "authenticated_user" USING ((current_setting('app.user_id', true)::uuid = "user_credentials"."user_id")) WITH CHECK ((current_setting('app.user_id', true)::uuid = "user_credentials"."user_id"));--> statement-breakpoint
CREATE POLICY "user_credentials_update_by_credential" ON "user_credentials" AS PERMISSIVE FOR UPDATE TO "authenticated_user" USING ((current_setting('app.credential_id', true) = "user_credentials"."id")) WITH CHECK ((current_setting('app.credential_id', true) = "user_credentials"."id") AND (current_setting('app.user_id', true)::uuid = "user_credentials"."user_id"));--> statement-breakpoint
CREATE POLICY "user_credentials_delete_own" ON "user_credentials" AS PERMISSIVE FOR DELETE TO "authenticated_user" USING ((current_setting('app.user_id', true)::uuid = "user_credentials"."user_id"));--> statement-breakpoint
CREATE POLICY "user_roles_select_own" ON "user_roles" AS PERMISSIVE FOR SELECT TO "authenticated_user" USING ((current_setting('app.user_id', true)::uuid = "user_roles"."user_id"));--> statement-breakpoint
CREATE POLICY "user_sessions_select_own" ON "user_sessions" AS PERMISSIVE FOR SELECT TO "authenticated_user" USING ((current_setting('app.user_id', true)::uuid = "user_sessions"."user_id"));--> statement-breakpoint
CREATE POLICY "user_sessions_insert_own" ON "user_sessions" AS PERMISSIVE FOR INSERT TO "authenticated_user" WITH CHECK ((current_setting('app.user_id', true)::uuid = "user_sessions"."user_id"));--> statement-breakpoint
CREATE POLICY "user_sessions_update_own" ON "user_sessions" AS PERMISSIVE FOR UPDATE TO "authenticated_user" USING ((current_setting('app.user_id', true)::uuid = "user_sessions"."user_id")) WITH CHECK ((current_setting('app.user_id', true)::uuid = "user_sessions"."user_id"));--> statement-breakpoint
CREATE POLICY "user_sessions_delete_own" ON "user_sessions" AS PERMISSIVE FOR DELETE TO "authenticated_user" USING ((current_setting('app.user_id', true)::uuid = "user_sessions"."user_id"));--> statement-breakpoint
CREATE POLICY "users_select_own" ON "users" AS PERMISSIVE FOR SELECT TO "authenticated_user" USING ((current_setting('app.user_id', true)::uuid = "users"."id"));--> statement-breakpoint
CREATE POLICY "users_update_own" ON "users" AS PERMISSIVE FOR UPDATE TO "authenticated_user" USING ((current_setting('app.user_id', true)::uuid = "users"."id")) WITH CHECK ((current_setting('app.user_id', true)::uuid = "users"."id"));