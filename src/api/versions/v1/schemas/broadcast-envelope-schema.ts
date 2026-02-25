import { z } from "zod";
import { BroadcastCommandType } from "../enums/broadcast-command-enum.ts";

export const BroadcastEnvelopeSchema = z.object({
  command: z.nativeEnum(BroadcastCommandType),
  payload: z.any(),
  originInstanceId: z.string().uuid(),
});
