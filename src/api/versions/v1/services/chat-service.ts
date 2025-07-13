import { inject, injectable } from "@needle-di/core";
import { BinaryReader } from "../../../../core/utils/binary-reader-utils.ts";
import { BinaryWriter } from "../../../../core/utils/binary-writer-utils.ts";
import { WebSocketType } from "../enums/websocket-enum.ts";
import { WebSocketUser } from "../models/websocket-user.ts";
import { MatchPlayersService } from "./match-players-service.ts";
import type { IWebSocketService } from "../interfaces/websocket-adapter.ts";

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
    const message = reader.variableLengthString();
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
