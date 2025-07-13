import { inject, injectable } from "@needle-di/core";
import { BinaryReader } from "../../../../core/utils/binary-reader-utils.ts";
import { BinaryWriter } from "../../../../core/utils/binary-writer-utils.ts";
import { WebSocketType } from "../enums/websocket-enum.ts";
import { WebSocketUser } from "../models/websocket-user.ts";
import { MatchPlayersService } from "./match-players-service.ts";
import type { WebSocketAdapter } from "../interfaces/websocket-adapter.ts";

@injectable()
export class ChatService {
  constructor(
    private matchPlayersService = inject(MatchPlayersService),
  ) {}

  public handleChatMessage(
    wsAdapter: WebSocketAdapter,
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

    // Send to host
    const hostUser = wsAdapter.getUserByToken(hostToken);
    if (hostUser) {
      wsAdapter.sendMessage(hostUser, payload);
    }

    const players = this.matchPlayersService.getPlayersByToken(hostToken);
    for (const playerId of players) {
      // Skip host to avoid duplicate messages
      if (hostUser && playerId === hostUser.getId()) {
        continue;
      }
      const player = wsAdapter.getUserById(playerId);
      if (player) {
        wsAdapter.sendMessage(player, payload);
      }
    }
  }
}
