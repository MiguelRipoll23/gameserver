CREATE ROLE "authenticated_user";--> statement-breakpoint
CREATE TABLE "blocked_words" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "blocked_words_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"word" varchar(255) NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "match_users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "match_users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"match_id" integer NOT NULL,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "matches_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"host_user_id" uuid NOT NULL,
	"client_version" varchar(16) NOT NULL,
	"total_slots" integer NOT NULL,
	"available_slots" integer NOT NULL,
	"ping_median_milliseconds" integer DEFAULT 0 NOT NULL,
	"attributes" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matches_host_user_id_unique" UNIQUE("host_user_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "roles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "server_messages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "server_messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"title" varchar NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_bans" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_bans_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"reason" varchar(500) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "user_bans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_credentials" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"public_key" text NOT NULL,
	"counter" integer NOT NULL,
	"device_type" varchar(32) NOT NULL,
	"backup_status" boolean NOT NULL,
	"transports" jsonb
);
--> statement-breakpoint
ALTER TABLE "user_credentials" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_reports" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_reports_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"reporter_user_id" uuid NOT NULL,
	"reported_user_id" uuid NOT NULL,
	"reason" varchar(500) NOT NULL,
	"automatic" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_roles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"role_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_idx" UNIQUE("user_id","role_id")
);
--> statement-breakpoint
ALTER TABLE "user_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_scores" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_scores_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"total_score" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "user_scores_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"token" varchar(44) NOT NULL,
	"public_ip" "inet" NOT NULL,
	"country" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "user_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" varchar(16) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_display_name_unique" UNIQUE("display_name")
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "match_users" ADD CONSTRAINT "match_users_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_users" ADD CONSTRAINT "match_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_host_user_id_users_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_bans" ADD CONSTRAINT "user_bans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_credentials" ADD CONSTRAINT "user_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reported_user_id_users_id_fk" FOREIGN KEY ("reported_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_scores" ADD CONSTRAINT "user_scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_lower_word" ON "blocked_words" USING btree (lower("word"));--> statement-breakpoint
CREATE INDEX "match_users_match_id_user_id_idx" ON "match_users" USING btree ("match_id","user_id");--> statement-breakpoint
CREATE INDEX "match_users_user_id_idx" ON "match_users" USING btree ("user_id");--> statement-breakpoint
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