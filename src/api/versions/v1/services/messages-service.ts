import { inject, injectable } from "@needle-di/core";
import { KVService } from "../../../../core/services/kv-service.ts";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import {
  CreateMessageRequest,
  GetMessageResponse,
} from "../schemas/messages-schemas.ts";
import { serverMessagesTable } from "../../../../db/schema.ts";
import { desc, eq } from "drizzle-orm";

@injectable()
export class MessagesService {
  constructor(
    private kvService = inject(KVService),
    private databaseService = inject(DatabaseService)
  ) {}

  public async list(): Promise<GetMessageResponse> {
    const db = this.databaseService.get();
    const messages = await db
      .select()
      .from(serverMessagesTable)
      .orderBy(desc(serverMessagesTable.createdAt));

    // Convert database result to ServerMessageKV format for compatibility
    return messages.map((message) => ({
      title: message.title,
      content: message.content,
      timestamp: message.createdAt.getTime(),
    }));
  }

  public async create(messageRequest: CreateMessageRequest): Promise<void> {
    const db = this.databaseService.get();
    await db.insert(serverMessagesTable).values({
      title: messageRequest.title,
      content: messageRequest.content,
    });
  }

  public async delete(timestamp: string): Promise<void> {
    const db = this.databaseService.get();
    const timestampDate = new Date(parseInt(timestamp));
    await db
      .delete(serverMessagesTable)
      .where(eq(serverMessagesTable.createdAt, timestampDate));
  }
}
