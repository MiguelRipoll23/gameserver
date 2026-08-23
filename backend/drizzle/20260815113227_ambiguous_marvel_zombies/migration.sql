CREATE TABLE "anticheat_definitions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "anticheat_definitions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"kind" varchar(32) NOT NULL,
	"key" varchar(32) NOT NULL,
	"parent_key" varchar(32) DEFAULT '' NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"hint" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "anticheat_definitions_unique_entry" ON "anticheat_definitions" ("kind","key","parent_key");
