import { pgTable, serial, varchar, text, timestamp } from "drizzle-orm/pg-core";

export const serverMessagesTable = pgTable("server_messages", {
  id: serial("id").primaryKey(),
  title: varchar("title").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type ServerMessageEntity = typeof serverMessagesTable.$inferSelect;
export type ServerMessageInsertEntity = typeof serverMessagesTable.$inferInsert;
