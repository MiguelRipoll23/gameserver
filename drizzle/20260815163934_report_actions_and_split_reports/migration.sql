CREATE TYPE "anticheat_rule_action" AS ENUM ('report', 'ban');
--> statement-breakpoint
ALTER TABLE "anticheat_rules" ADD COLUMN "action" "anticheat_rule_action" DEFAULT 'report' NOT NULL;
--> statement-breakpoint
DROP TABLE "user_reports";
--> statement-breakpoint
CREATE TABLE "user_reports_manual" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_reports_manual_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"issued_by_user_id" uuid NOT NULL,
	"reason" varchar(500) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "user_reports_manual" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "user_reports_automatic" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_reports_automatic_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"issued_by_user_id" uuid,
	"rule_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "user_reports_automatic" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "user_reports_manual" ADD CONSTRAINT "user_reports_manual_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "user_reports_manual" ADD CONSTRAINT "user_reports_manual_issued_by_user_id_users_id_fkey" FOREIGN KEY ("issued_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "user_reports_automatic" ADD CONSTRAINT "user_reports_automatic_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "user_reports_automatic" ADD CONSTRAINT "user_reports_automatic_issued_by_user_id_users_id_fkey" FOREIGN KEY ("issued_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE;
--> statement-breakpoint
CREATE POLICY "user_reports_manual_select_own" ON "user_reports_manual" AS PERMISSIVE FOR SELECT TO "authenticated_user" USING ((current_setting('app.user_id', true)::uuid = "user_reports_manual"."user_id"));
--> statement-breakpoint
CREATE POLICY "user_reports_automatic_select_own" ON "user_reports_automatic" AS PERMISSIVE FOR SELECT TO "authenticated_user" USING ((current_setting('app.user_id', true)::uuid = "user_reports_automatic"."user_id"));
