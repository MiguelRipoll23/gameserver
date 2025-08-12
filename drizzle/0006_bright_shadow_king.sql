ALTER TABLE "user_roles" DROP CONSTRAINT "unique_user_role";--> statement-breakpoint
ALTER TABLE "roles" DROP COLUMN "description";--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_role_id_idx" UNIQUE("user_id","role_id");