import { z } from "@hono/zod-openapi";

export const AntiCheatRuleFieldSchema = z
  .object({
    fieldId: z
      .number()
      .int()
      .min(0)
      .max(255)
      .describe("Parameter identifier (meaning depends on rule type)")
      .openapi({ example: 0 }),
    valueType: z
      .number()
      .int()
      .min(0)
      .max(255)
      .describe("0x00 = uint16, 0x01 = float32")
      .openapi({ example: 0x01 }),
    value: z
      .number()
      .describe("The numeric value")
      .openapi({ example: 10 }),
  })
  .describe("A typed field that parameterizes an anti-cheat rule");

export const AntiCheatRuleSchema = z
  .object({
    ruleId: z
      .number()
      .int()
      .min(0)
      .max(65535)
      .describe("Unique rule identifier")
      .openapi({ example: 1 }),
    ruleType: z
      .number()
      .int()
      .min(0)
      .max(255)
      .describe(
        "Category of the rule (0x00 = EventRateLimit, 0x01 = MovementSpeedLimit)",
      )
      .openapi({ example: 0x01 }),
    fields: z
      .array(AntiCheatRuleFieldSchema)
      .describe("Typed fields that parameterize the rule")
      .openapi({
        example: [
          { fieldId: 0, valueType: 0x01, value: 600 },
          { fieldId: 1, valueType: 0x01, value: 3 },
          { fieldId: 2, valueType: 0x00, value: 0 },
        ],
      }),
  })
  .describe("An anti-cheat rule");

export const GetAntiCheatRulesResponseSchema = z
  .object({
    rules: z
      .array(AntiCheatRuleSchema)
      .describe("All configured anti-cheat rules"),
  })
  .openapi({
    example: {
      rules: [
        {
          ruleId: 1,
          ruleType: 1,
          fields: [
            { fieldId: 0, valueType: 1, value: 600 },
            { fieldId: 1, valueType: 1, value: 3 },
            { fieldId: 2, valueType: 0, value: 0 },
          ],
        },
      ],
    },
  });

export type GetAntiCheatRulesResponse = z.infer<
  typeof GetAntiCheatRulesResponseSchema
>;

export const UpdateAntiCheatRulesRequestSchema = z
  .object({
    rules: z
      .array(AntiCheatRuleSchema)
      .describe("The full list of anti-cheat rules to replace the current set"),
  })
  .openapi({
    example: {
      rules: [
        {
          ruleId: 1,
          ruleType: 1,
          fields: [
            { fieldId: 0, valueType: 1, value: 600 },
            { fieldId: 1, valueType: 1, value: 3 },
            { fieldId: 2, valueType: 0, value: 0 },
          ],
        },
      ],
    },
  });

export type UpdateAntiCheatRulesRequest = z.infer<
  typeof UpdateAntiCheatRulesRequestSchema
>;
