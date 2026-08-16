/**
 * Deterministic name of the single WebSocketDurableObject instance.
 * Every caller must resolve the same instance, so this name is shared instead
 * of repeated (a typo would silently create a second, empty instance).
 */
export const WEBSOCKET_DURABLE_OBJECT_NAME = "websocket-durable-object";
