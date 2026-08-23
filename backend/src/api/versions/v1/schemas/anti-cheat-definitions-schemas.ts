import { z } from "@hono/zod-openapi";

export const AntiCheatRuleTypeDefinitionSchema = z
  .object({
    label: z
      .string()
      .describe("Human-readable name for this rule type")
      .openapi({ example: "Event rate limit" }),
    description: z
      .string()
      .describe("Longer explanation of what this rule type monitors")
      .openapi({
        example:
          "Limits how many events of one type a player can fire per time window.",
      }),
  })
  .describe("Display metadata for an anti-cheat rule type");

export const AntiCheatRuleFieldDefinitionSchema = z
  .object({
    label: z
      .string()
      .describe("Human-readable name for this field")
      .openapi({ example: "Max count" }),
    hint: z
      .string()
      .describe("Short hint explaining what value this field expects")
      .openapi({ example: "Max events allowed per window" }),
  })
  .describe("Display metadata for an anti-cheat rule field");

export const AntiCheatDefinitionsResponseSchema = z
  .object({
    ruleTypes: z
      .record(z.string(), AntiCheatRuleTypeDefinitionSchema)
      .describe(
        "Maps numeric rule type IDs to their display label and description",
      ),
    ruleFields: z
      .record(z.string(), z.record(z.string(), AntiCheatRuleFieldDefinitionSchema))
      .describe(
        "Per rule type, maps numeric field IDs to their display label and hint",
      ),
    eventNames: z
      .record(z.string(), z.string())
      .describe("Maps numeric event type IDs to their display name"),
    entityNames: z
      .record(z.string(), z.string())
      .describe("Maps numeric entity type IDs to their display name"),
    valueTypes: z
      .record(z.string(), z.string())
      .describe("Maps numeric value type IDs to their type names"),
  })
  .describe(
    "Anti-cheat rule definitions used by the management console to render rules",
  )
  .openapi({
    example: {
      ruleTypes: {
        "0": {
          label: "Event rate limit",
          description:
            "Limits how many events of one type a player can fire per time window.",
        },
        "1": {
          label: "Movement speed limit",
          description:
            "Limits how far a scene entity can move within a time window.",
        },
      },
      ruleFields: {
        "0": {
          "0": { label: "Event type", hint: "Which event is being limited" },
          "1": { label: "Max count", hint: "Max events allowed per window" },
          "2": { label: "Window", hint: "Time window in seconds" },
        },
        "1": {
          "0": { label: "Max distance", hint: "Max movement in px per window" },
          "1": { label: "Window", hint: "Time window in seconds" },
          "2": { label: "Entity type", hint: "0 = all types" },
        },
      },
      eventNames: {
        "9": "Countdown",
        "10": "Goal scored",
        "11": "Game over",
        "12": "Boost pad consumed",
        "15": "Car demolished",
        "18": "Player banned",
      },
      entityNames: {
        "0": "All types",
        "1": "Local car",
        "2": "Remote car",
        "3": "NPC car",
        "4": "Goal",
        "5": "Goal explosion",
        "6": "Car explosion",
        "7": "Boost pad",
        "10": "Scoreboard",
        "11": "Alert",
        "12": "Toast",
        "13": "Help",
        "14": "Match log",
        "15": "Boost meter",
        "20": "World background",
      },
      valueTypes: {
        "0": "uint16",
        "1": "float32",
      },
    },
  });

export type AntiCheatDefinitionsResponse = z.infer<
  typeof AntiCheatDefinitionsResponseSchema
>;

export const UpdateAntiCheatDefinitionsRequestSchema =
  AntiCheatDefinitionsResponseSchema;

export type UpdateAntiCheatDefinitionsRequest = z.infer<
  typeof UpdateAntiCheatDefinitionsRequestSchema
>;
