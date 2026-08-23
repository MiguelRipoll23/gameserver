import { z } from "@hono/zod-openapi";
import { DiscordInteractionResponseType } from "../enums/discord-interaction-response-enum.ts";

const DiscordInteractionOptionSchema = z.object({
  name: z.string().describe("The option name"),
  type: z.number().describe("The option type"),
  value: z
    .union([z.string(), z.number()])
    .optional()
    .describe("The option value"),
  options: z
    .array(
      z.object({
        name: z.string().describe("The option name"),
        type: z.number().describe("The option type"),
        value: z
          .union([z.string(), z.number()])
          .optional()
          .describe("The option value"),
      }),
    )
    .optional()
    .describe("Nested options"),
});

export const DiscordInteractionPayloadSchema = z.object({
  id: z.string().describe("The interaction identifier"),
  token: z.string().describe("The interaction token"),
  type: z.number().describe("The interaction type"),
  guild_id: z.string().optional().describe("The guild identifier"),
  data: z
    .object({
      name: z.string().optional().describe("The command name"),
      type: z.number().optional().describe("The command type"),
      options: z
        .array(DiscordInteractionOptionSchema)
        .optional()
        .describe("The command options"),
    })
    .optional()
    .describe("The command data"),
  member: z
    .object({
      roles: z.array(z.string()).optional().describe(
        "The member role identifiers",
      ),
    })
    .optional()
    .describe("The invoking guild member"),
  user: z
    .object({
      id: z.string().optional().describe("The user identifier"),
    })
    .optional()
    .describe("The invoking user"),
});

export const DiscordInteractionResponseSchema = z.object({
  type: z
    .nativeEnum(DiscordInteractionResponseType)
    .describe("The interaction response type"),
  data: z
    .object({
      content: z.string().optional().describe("The message content"),
      embeds: z
        .array(
          z.object({
            title: z.string().optional().describe("The embed title"),
            description: z.string().optional().describe(
              "The embed description",
            ),
            color: z.number().optional().describe("The embed color"),
            fields: z
              .array(
                z.object({
                  name: z.string().describe("The field name"),
                  value: z.string().describe("The field value"),
                  inline: z.boolean().optional().describe(
                    "Whether the field is inline",
                  ),
                }),
              )
              .optional()
              .describe("The embed fields"),
          }),
        )
        .optional()
        .describe("The embeds"),
      flags: z.number().optional().describe("The message flags"),
    })
    .optional()
    .describe("The interaction response data"),
});
