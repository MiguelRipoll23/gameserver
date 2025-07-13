import { inject, injectable } from "@needle-di/core";
import { BinaryReader } from "../../../../core/utils/binary-reader-utils.ts";
import { BinaryWriter } from "../../../../core/utils/binary-writer-utils.ts";
import { WebSocketType } from "../enums/websocket-enum.ts";
import { WebSocketUser } from "../models/websocket-user.ts";
import { MatchPlayersService } from "./match-players-service.ts";
import type { IWebSocketService } from "../interfaces/websocket-adapter.ts";

const MAX_CHAT_MESSAGE_LENGTH = 256;

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
    if (message.length === 0 || message.length > MAX_CHAT_MESSAGE_LENGTH) {
      console.warn(
        `Rejected chat message from ${user.getName()} due to invalid length`,
      );
      return;
    }
    const hostToken = user.getHostToken() ?? user.getUserToken();

    console.log(
      `Broadcasting chat message from ${user.getName()} to ${hostToken} with content: ${message}`,
    );

    const payload = BinaryWriter.build()
      .unsignedInt8(WebSocketType.ChatMessage)
      .fixedLengthString(user.getId(), 32)
      .variableLengthString(message)
      .toArrayBuffer();

    const recipients = new Set<string>();
    const hostUser = wsAdapter.getUserByToken(hostToken);
    if (hostUser) {
      recipients.add(hostUser.getId());
    }

    for (
      const playerId of this.matchPlayersService.getPlayersByToken(hostToken)
    ) {
      recipients.add(playerId);
    }

    for (const id of recipients) {
      const target = wsAdapter.getUserById(id);
      if (target) {
        wsAdapter.sendMessage(target, payload);
      }
    }
  }
}
