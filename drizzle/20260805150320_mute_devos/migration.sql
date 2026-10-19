CREATE TABLE "bots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" varchar(32) NOT NULL UNIQUE,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY "device_authorization_codes_all_select" ON "device_authorization_codes";--> statement-breakpoint
DROP POLICY "device_authorization_codes_all_insert" ON "device_authorization_codes";--> statement-breakpoint
DROP POLICY "device_authorization_codes_all_update" ON "device_authorization_codes";--> statement-breakpoint
DROP POLICY "device_authorization_codes_all_delete" ON "device_authorization_codes";--> statement-breakpoint
DROP TABLE "device_authorization_codes";--> statement-breakpoint
ALTER TABLE "bots" ADD CONSTRAINT "bots_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE POLICY "bots_select_own" ON "bots" AS PERMISSIVE FOR SELECT TO "authenticated_user" USING ((current_setting('app.user_id', true)::uuid = "bots"."created_by"));--> statement-breakpoint
CREATE POLICY "bots_insert_own" ON "bots" AS PERMISSIVE FOR INSERT TO "authenticated_user" WITH CHECK ((current_setting('app.user_id', true)::uuid = "bots"."created_by"));--> statement-breakpoint
CREATE POLICY "bots_delete_own" ON "bots" AS PERMISSIVE FOR DELETE TO "authenticated_user" USING ((current_setting('app.user_id', true)::uuid = "bots"."created_by"));