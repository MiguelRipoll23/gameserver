import { inject, injectable } from "@needle-di/core";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import {
  CreateMessageRequest,
  GetMessageResponse,
  UpdateMessageRequest,
} from "../schemas/messages-schemas.ts";
import { serverMessagesTable } from "../../../../db/schema.ts";
import { desc, eq } from "drizzle-orm";
import { ServerError } from "../models/server-error.ts";

@injectable()
export class MessagesService {
  constructor(
    private databaseService = inject(DatabaseService)
  ) {}

  public async list(): Promise<GetMessageResponse> {
    const db = this.databaseService.get();
    const messages = await db
      .select()
      .from(serverMessagesTable)
      .orderBy(desc(serverMessagesTable.createdAt))
      .limit(5);

    return messages.map((message) => ({
      id: message.id,
      title: message.title,
      content: message.content,
      createdAt: message.createdAt.getTime(),
      updatedAt: message.updatedAt?.getTime(),
    }));
  }

  public async create(messageRequest: CreateMessageRequest): Promise<void> {
    const db = this.databaseService.get();
    await db.insert(serverMessagesTable).values({
      title: messageRequest.title,
      content: messageRequest.content,
    });
  }

  public async delete(id: number): Promise<void> {
    const db = this.databaseService.get();
    const deleted = await db
      .delete(serverMessagesTable)
      .where(eq(serverMessagesTable.id, id))
      .returning();

    if (deleted.length === 0) {
      throw new ServerError(
        "MESSAGE_NOT_FOUND",
        `Message with id ${id} does not exist`,
        404
      );
    }
  }

  public async update(messageRequest: UpdateMessageRequest): Promise<GetMessageResponse[number]> {
    const db = this.databaseService.get();
    
    const updated = await db
      .update(serverMessagesTable)
      .set({
        title: messageRequest.title,
        content: messageRequest.content,
        updatedAt: new Date(),
      })
      .where(eq(serverMessagesTable.id, messageRequest.id))
      .returning();

    if (updated.length === 0) {
      throw new ServerError(
        "MESSAGE_NOT_FOUND",
        `Message with id ${messageRequest.id} does not exist`,
        404
      );
    }

    const msg = updated[0];
    return {
      id: msg.id,
      title: msg.title,
      content: msg.content,
      createdAt: msg.createdAt.getTime(),
      updatedAt: msg.updatedAt?.getTime(),
    };
  }
}
