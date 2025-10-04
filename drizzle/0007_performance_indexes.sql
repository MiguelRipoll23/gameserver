-- Add performance indexes for authentication service queries

-- Index for user credentials lookup by ID (already has primary key index)
-- No additional index needed for user_credentials.id since it's a primary key

-- Index for user sessions by user_id (frequently queried in authentication)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "user_sessions_user_id_idx" ON "user_sessions" USING btree ("user_id");

-- Index for user bans by user_id and created_at (for latest ban lookup)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "user_bans_user_id_created_at_idx" ON "user_bans" USING btree ("user_id", "created_at" DESC);

-- Index for user roles by user_id (for role lookups during authentication)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "user_roles_user_id_idx" ON "user_roles" USING btree ("user_id");

-- Index for user credentials by user_id (for user credential lookups)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "user_credentials_user_id_idx" ON "user_credentials" USING btree ("user_id");

-- Composite index for user ban expiration checks
CREATE INDEX CONCURRENTLY IF NOT EXISTS "user_bans_expires_at_idx" ON "user_bans" USING btree ("expires_at") WHERE "expires_at" IS NOT NULL;