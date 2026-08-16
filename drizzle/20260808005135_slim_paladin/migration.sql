CREATE TABLE "authentication_challenges" (
	"id" serial PRIMARY KEY,
	"transaction_id" uuid NOT NULL,
	"type" varchar(32) NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "authentication_challenges_transaction_id_type_unique" UNIQUE("transaction_id","type")
);
--> statement-breakpoint
ALTER TABLE "authentication_challenges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "authentication_challenges_all_insert" ON "authentication_challenges" AS PERMISSIVE FOR INSERT TO "authenticated_user" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "authentication_challenges_all_select" ON "authentication_challenges" AS PERMISSIVE FOR SELECT TO "authenticated_user" USING (true);--> statement-breakpoint
CREATE POLICY "authentication_challenges_all_delete" ON "authentication_challenges" AS PERMISSIVE FOR DELETE TO "authenticated_user" USING (true);