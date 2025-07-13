import { inject, injectable } from "@needle-di/core";
import { BinaryReader } from "../../../../core/utils/binary-reader-utils.ts";
import { BinaryWriter } from "../../../../core/utils/binary-writer-utils.ts";
import { WebSocketType } from "../enums/websocket-enum.ts";
import { WebSocketUser } from "../models/websocket-user.ts";
import { MatchPlayersService } from "./match-players-service.ts";
import type { IWebSocketService } from "../interfaces/websocket-adapter.ts";
import blockWords from "../data/block-words.json" with { type: "json" };

const MAX_CHAT_MESSAGE_LENGTH = 35;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function filterMessage(message: string): string {
  for (const word of blockWords as string[]) {
    const regex = new RegExp(`\\b${escapeRegExp(word)}\\b`, "gi");
    message = message.replace(
      regex,
      (matched: string) => "*".repeat(matched.length),
    );
  }
  return message;
}

@injectable()
export class ChatService {
  constructor(
    private matchPlayersService = inject(MatchPlayersService),
  ) {}

  public handleChatMessage(
    wsAdapter: IWebSocketService,
    user: WebSocketUser,
    reader: BinaryReader,
  ): void {
    let message = reader.variableLengthString().trim();
    if (message.length === 0) {
      console.warn(
        `Rejected chat message from ${user.getName()} because it is empty`,
      );
      return;
    }
    if (message.length > MAX_CHAT_MESSAGE_LENGTH) {
      console.warn(
        `Rejected chat message from ${user.getName()} because it exceeds the limit of ${MAX_CHAT_MESSAGE_LENGTH} characters`,
      );
      return;
    }
    message = filterMessage(message);

    const hostToken = user.getHostToken() ?? user.getUserToken();

    console.log(
      `Broadcasting chat message from ${user.getName()} to ${hostToken} with content: ${message}`,
    );

    const payload = BinaryWriter.build()
      .unsignedInt8(WebSocketType.ChatMessage)
      .fixedLengthString(user.getId(), 32)
      .variableLengthString(message)
      .toArrayBuffer();

    // Broadcast to all players in the match
    for (const playerId of this.matchPlayersService.getPlayersByToken(hostToken)) {
      const target = wsAdapter.getUserById(playerId);
      if (target) {
        wsAdapter.sendMessage(target, payload);
      }
    }

    // Ensure the host also receives the message
    const host = wsAdapter.getUserByToken(hostToken);
    if (host) {
      wsAdapter.sendMessage(host, payload);
    }
  }
}
