CREATE TABLE "bot_roles" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bot_roles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"bot_id" uuid NOT NULL,
	"role_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bot_roles_bot_id_role_id_idx" UNIQUE("bot_id","role_id")
);
--> statement-breakpoint
ALTER TABLE "bot_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bots" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "bot_roles" ADD CONSTRAINT "bot_roles_bot_id_bots_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "bots"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "bot_roles" ADD CONSTRAINT "bot_roles_role_id_roles_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE POLICY "bot_roles_select_own" ON "bot_roles" AS PERMISSIVE FOR SELECT TO "authenticated_user" USING ((current_setting('app.user_id', true)::uuid = (SELECT "bots"."created_by" FROM "bots" WHERE "bots"."id" = "bot_roles"."bot_id")));--> statement-breakpoint
CREATE POLICY "bot_roles_insert_own" ON "bot_roles" AS PERMISSIVE FOR INSERT TO "authenticated_user" WITH CHECK ((current_setting('app.user_id', true)::uuid = (SELECT "bots"."created_by" FROM "bots" WHERE "bots"."id" = "bot_roles"."bot_id")));--> statement-breakpoint
CREATE POLICY "bot_roles_delete_own" ON "bot_roles" AS PERMISSIVE FOR DELETE TO "authenticated_user" USING ((current_setting('app.user_id', true)::uuid = (SELECT "bots"."created_by" FROM "bots" WHERE "bots"."id" = "bot_roles"."bot_id")));--> statement-breakpoint
CREATE POLICY "bots_update_own" ON "bots" AS PERMISSIVE FOR UPDATE TO "authenticated_user" USING ((current_setting('app.user_id', true)::uuid = "bots"."created_by")) WITH CHECK ((current_setting('app.user_id', true)::uuid = "bots"."created_by"));