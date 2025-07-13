import { BinaryReader } from "../../../../core/utils/binary-reader-utils.ts";

export type CommandHandlerFunction = (binaryReader: BinaryReader) => void;
