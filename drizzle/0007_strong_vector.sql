CREATE TABLE "authentication_options" (
	"transaction_id" varchar(255) PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registration_options" (
	"transaction_id" varchar(255) PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
