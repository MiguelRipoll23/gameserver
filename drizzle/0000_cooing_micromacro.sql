CREATE TABLE "matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" varchar(32) NOT NULL,
	"host_user_id" uuid NOT NULL,
	"version" varchar(16) NOT NULL,
	"total_slots" integer NOT NULL,
	"available_slots" integer NOT NULL,
	"attributes" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matches_host_user_id_unique" UNIQUE("host_user_id")
);
--> statement-breakpoint
CREATE TABLE "server_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_credentials" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"user_display_name" varchar(255) NOT NULL,
	"public_key" text NOT NULL,
	"counter" integer NOT NULL,
	"device_type" varchar(32) NOT NULL,
	"backup_status" boolean NOT NULL,
	"transports" jsonb
);
--> statement-breakpoint
CREATE TABLE "user_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"reason" varchar NOT NULL,
	"automatic" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_scores" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"user_display_name" varchar(16) NOT NULL,
	"total_score" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "userSessions" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" varchar(16) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_display_name_unique" UNIQUE("display_name")
);
--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_session_id_userSessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."userSessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_host_user_id_users_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_credentials" ADD CONSTRAINT "user_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_scores" ADD CONSTRAINT "user_scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "userSessions" ADD CONSTRAINT "userSessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;