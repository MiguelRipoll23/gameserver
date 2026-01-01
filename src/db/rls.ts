import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

// Helper function to check if current user ID matches a user ID column
export const isCurrentUser = (userIdColumn: AnyPgColumn) =>
  sql`(current_setting('app.user_id', true)::uuid = ${userIdColumn})`;

// Helper function to check if current credential ID matches a credential ID column
export const isCurrentCredential = (credentialIdColumn: AnyPgColumn) =>
  sql`(current_setting('app.credential_id', true) = ${credentialIdColumn})`;
