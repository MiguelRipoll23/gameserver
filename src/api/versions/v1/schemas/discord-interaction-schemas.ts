import { z } from "@hono/zod-openapi";
import { DiscordInteractionResponseType } from "../enums/discord-interaction-response-enum.ts";

const DiscordInteractionOptionSchema = z.object({
  name: z
    .string()
    .describe("The option name")
    .openapi({ example: "text" }),
  type: z
    .number()
    .describe("The option type")
    .openapi({ example: 3 }),
  value: z
    .union([z.string(), z.number()])
    .optional()
    .describe("The option value")
    .openapi({ example: "Maintenance in 10 minutes" }),
  options: z
    .array(
      z.object({
        name: z
          .string()
          .describe("The option name")
          .openapi({ example: "title" }),
        type: z
          .number()
          .describe("The option type")
          .openapi({ example: 3 }),
        value: z
          .union([z.string(), z.number()])
          .optional()
          .describe("The option value")
          .openapi({ example: "Server maintenance" }),
      }),
    )
    .optional()
    .describe("Nested options"),
});

export const DiscordInteractionPayloadSchema = z.object({
  id: z
    .string()
    .describe("The interaction identifier")
    .openapi({ example: "123456789012345678" }),
  token: z
    .string()
    .describe("The interaction token")
    .openapi({ example: "interaction-token" }),
  type: z
    .number()
    .describe("The interaction type")
    .openapi({ example: 2 }),
  guild_id: z
    .string()
    .optional()
    .describe("The guild identifier")
    .openapi({ example: "1528801623038623844" }),
  data: z
    .object({
      name: z
        .string()
        .optional()
        .describe("The command name")
        .openapi({ example: "alert" }),
      type: z
        .number()
        .optional()
        .describe("The command type")
        .openapi({ example: 1 }),
      options: z
        .array(DiscordInteractionOptionSchema)
        .optional()
        .describe("The command options"),
    })
    .optional()
    .describe("The command data"),
  member: z
    .object({
      roles: z
        .array(z.string())
        .optional()
        .describe("The member role identifiers")
        .openapi({ example: ["123456789012345678", "234567890123456789"] }),
    })
    .optional()
    .describe("The invoking guild member"),
  user: z
    .object({
      id: z
        .string()
        .optional()
        .describe("The user identifier")
        .openapi({ example: "987654321098765432" }),
    })
    .optional()
    .describe("The invoking user"),
});

export const DiscordInteractionResponseSchema = z.object({
  type: z
    .nativeEnum(DiscordInteractionResponseType)
    .describe("The interaction response type")
    .openapi({
      example: DiscordInteractionResponseType.ChannelMessageWithSource,
    }),
  data: z
    .object({
      embeds: z
        .array(
          z.object({
            title: z
              .string()
              .optional()
              .describe("The embed title")
              .openapi({ example: "Alert sent" }),
            description: z
              .string()
              .optional()
              .describe("The embed description")
              .openapi({ example: "Flash news pushed to **GLOBAL** players." }),
            color: z
              .number()
              .optional()
              .describe("The embed color")
              .openapi({ example: 0x57F287 }),
            fields: z
              .array(
                z.object({
                  name: z
                    .string()
                    .describe("The field name")
                    .openapi({ example: "Title" }),
                  value: z
                    .string()
                    .describe("The field value")
                    .openapi({ example: "Server maintenance" }),
                  inline: z
                    .boolean()
                    .optional()
                    .describe("Whether the field is inline")
                    .openapi({ example: false }),
                }),
              )
              .optional()
              .describe("The embed fields"),
          }),
        )
        .optional()
        .describe("The embeds"),
      flags: z
        .number()
        .optional()
        .describe("The message flags")
        .openapi({ example: 64 }),
    })
    .optional()
    .describe("The interaction response data"),
});
