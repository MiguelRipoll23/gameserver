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
  );

export type AntiCheatDefinitionsResponse = z.infer<
  typeof AntiCheatDefinitionsResponseSchema
>;

export const UpdateAntiCheatDefinitionsRequestSchema =
  AntiCheatDefinitionsResponseSchema;

export type UpdateAntiCheatDefinitionsRequest = z.infer<
  typeof UpdateAntiCheatDefinitionsRequestSchema
>;
