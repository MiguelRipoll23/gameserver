import { inject, injectable } from "@needle-di/core";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import {
  CreateServerMessageRequest,
  GetServerMessagesResponse,
  ServerMessageResponse,
  UpdateServerMessageRequest,
} from "../schemas/server-messages-schemas.ts";
import { PaginationParams } from "../schemas/pagination-schemas.ts";
import { serverMessagesTable } from "../../../../db/schema.ts";
import { desc, eq, lt } from "drizzle-orm";
import { ServerError } from "../models/server-error.ts";

@injectable()
export class ServerMessagesService {
  constructor(private databaseService = inject(DatabaseService)) {}

  public async list(
    params: PaginationParams,
  ): Promise<GetServerMessagesResponse> {
    const { cursor, limit = 20 } = params;
    const db = this.databaseService.get();

    let query = db.select().from(serverMessagesTable);
    if (cursor) {
      query = query.where(lt(serverMessagesTable.id, cursor));
    }

    const messages = await query
      .orderBy(desc(serverMessagesTable.id))
      .limit(limit + 1);

    const hasNextPage = messages.length > limit;
    const results = messages.slice(0, limit).map((message) => ({
      id: message.id,
      title: message.title,
      content: message.content,
      createdAt: message.createdAt.getTime(),
      updatedAt: message.updatedAt.getTime(),
    }));

    return {
      results,
      nextCursor: hasNextPage ? results[results.length - 1].id : undefined,
      hasMore: hasNextPage,
    };
  }

  public async create(
    messageRequest: CreateServerMessageRequest,
  ): Promise<void> {
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
        404,
      );
    }
  }

  public async update(
    messageRequest: UpdateServerMessageRequest,
  ): Promise<ServerMessageResponse> {
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
        404,
      );
    }

    const msg = updated[0];
    return {
      id: msg.id,
      title: msg.title,
      content: msg.content,
      createdAt: msg.createdAt.getTime(),
      updatedAt: msg.updatedAt.getTime(),
    };
  }
}
