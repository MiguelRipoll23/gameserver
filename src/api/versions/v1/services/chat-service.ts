import { inject, injectable } from "@needle-di/core";
import { BinaryReader } from "../../../../core/utils/binary-reader-utils.ts";
import { BinaryWriter } from "../../../../core/utils/binary-writer-utils.ts";
import { WebSocketType } from "../enums/websocket-enum.ts";
import { WebSocketUser } from "../models/websocket-user.ts";
import { MatchPlayersService } from "./match-players-service.ts";

@injectable()
export class ChatService {
  constructor(
    private matchPlayersService = inject(MatchPlayersService),
  ) {}

  public handleChatMessage(
    originUser: WebSocketUser,
    binaryReader: BinaryReader,
    usersById: Map<string, WebSocketUser>,
    sendMessage: (user: WebSocketUser, payload: ArrayBuffer) => void,
  ): void {
    const content = binaryReader.variableLengthString();
    const matchId = originUser.getMatchId();
    if (!matchId) return;

    const players = this.matchPlayersService.getPlayers(matchId);
    if (!players) return;

    const payload = BinaryWriter.build()
      .unsignedInt8(WebSocketType.ChatMessage)
      .fixedLengthString(originUser.getId(), 32)
      .variableLengthString(content)
      .toArrayBuffer();

    for (const playerId of players) {
      if (playerId === originUser.getId()) continue;
      const playerUser = usersById.get(playerId);
      if (playerUser) {
        sendMessage(playerUser, payload);
      }
    }
  }
}
