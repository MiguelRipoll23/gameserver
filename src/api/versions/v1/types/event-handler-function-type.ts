export type EventHandlerFunction<TPayload = unknown> = (
  payload: TPayload,
) => boolean | Promise<boolean>;
