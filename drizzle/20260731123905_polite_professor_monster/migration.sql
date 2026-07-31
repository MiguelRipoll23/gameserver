CREATE TABLE "device_authorization_codes" (
	"code" varchar(16) PRIMARY KEY,
	"encrypted_tokens" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "device_authorization_codes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "device_authorization_codes_all_insert" ON "device_authorization_codes" AS PERMISSIVE FOR INSERT TO "authenticated_user" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "device_authorization_codes_all_delete" ON "device_authorization_codes" AS PERMISSIVE FOR DELETE TO "authenticated_user" USING (true);