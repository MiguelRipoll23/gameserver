ALTER TABLE "roles" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "roles" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "roles" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "roles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "user_roles" ALTER COLUMN "role_id" SET DATA TYPE integer;