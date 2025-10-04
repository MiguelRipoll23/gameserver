export { userCredentialsTable } from "./tables/user-credentials-table.ts";
export { usersTable } from "./tables/users-table.ts";
export { userSessionsTable } from "./tables/user-sessions-table.ts";
export { matchesTable } from "./tables/matches-table.ts";
export { serverMessagesTable } from "./tables/server-messages-table.ts";
export { userReportsTable } from "./tables/user-reports-table.ts";
export { userBansTable } from "./tables/user-bans-table.ts";
export { userScoresTable } from "./tables/user-scores-table.ts";
export { blockedWordsTable } from "./tables/blocked-words-table.ts";
export { rolesTable } from "./tables/roles-table.ts";
export { userRolesTable } from "./tables/user-roles-table.ts";

// Export RLS roles and helpers
export * from "./rls.ts";
