ALTER TABLE "matches" RENAME COLUMN "version" TO "client_version";--> statement-breakpoint
CREATE INDEX "match_users_match_id_user_id_idx" ON "match_users" USING btree ("match_id","user_id");--> statement-breakpoint
CREATE INDEX "match_users_user_id_idx" ON "match_users" USING btree ("user_id");