import { BinaryReader } from "../../../../core/utils/binary-reader-utils.ts";
import { WebSocketUser } from "../models/websocket-user.ts";

export type CommandHandlerFunction = (
  user: WebSocketUser,
  binaryReader: BinaryReader,
) => void;
