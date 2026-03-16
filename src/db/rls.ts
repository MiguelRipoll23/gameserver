import { sql } from "drizzle-orm";
import { pgRole } from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

// Define roles for Row Level Security
// Using existing() for now due to limitations in Drizzle ORM's role management
export const authenticatedUserRole = pgRole("authenticated_user").existing();

// Helper function to check if current user ID matches a user ID column
export const isCurrentUser = (userIdColumn: AnyPgColumn) =>
  sql`(current_setting('app.user_id', true)::uuid = ${userIdColumn})`;

// Helper function to check if current credential ID matches a credential ID column
export const isCurrentCredential = (credentialIdColumn: AnyPgColumn) =>
  sql`(current_setting('app.credential_id', true) = ${credentialIdColumn})`;
