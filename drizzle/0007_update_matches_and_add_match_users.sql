-- Create match_users table
CREATE TABLE "match_users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "match_users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"match_id" integer NOT NULL,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint

-- Add foreign key constraints with cascade delete
ALTER TABLE "match_users" ADD CONSTRAINT "match_users_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_users" ADD CONSTRAINT "match_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Rename version column to client_version in matches table
ALTER TABLE "matches" RENAME COLUMN "version" TO "client_version";
