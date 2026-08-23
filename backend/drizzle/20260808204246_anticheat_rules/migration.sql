CREATE TABLE "anticheat_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"rule_id" integer NOT NULL UNIQUE,
	"rule_type" integer NOT NULL,
	"fields" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
