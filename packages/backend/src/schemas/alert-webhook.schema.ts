import z from "zod";

import { AlertKindSchema } from "./alert.schema";

export const WEBHOOK_URL_PATTERN =
  /^https:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/api(?:\/v\d+)?\/webhooks\/(\d{17,20})\/([\w-]+)\/?$/;

export const DISCORD_MESSAGE_MAX_LENGTH = 2000;

export const AlertWebhookUrlSchema = z
  .string()
  .trim()
  .refine(
    (url) => url === "" || WEBHOOK_URL_PATTERN.test(url),
    "Paste the URL of a Discord webhook",
  )
  .optional()
  .meta({
    description:
      "URL of the Discord webhook as copied from the channel settings, keeps the saved one when empty or left out",
  });

export const AlertWebhookKindsSchema = z
  .array(AlertKindSchema, { error: "Pick at least one alert" })
  .min(1, "Pick at least one alert")
  .meta({ description: "Alerts posted to the webhook" });

export const AlertWebhookSchema = z.object({
  webhookId: z.string().nullable().meta({
    description: "ID of the Discord webhook, null when none is set",
  }),
  enabled: z.boolean().meta({ description: "Whether the alerts are posted" }),
  content: z.string().meta({
    description: "Text posted with every alert, where the mentions go",
  }),
  kinds: z.array(AlertKindSchema).meta({ description: "Alerts posted to the webhook" }),
  notifyResolved: z.boolean().meta({
    description: "Whether a message is also posted when an alert is resolved",
  }),
  lastDeliveredAt: z.iso.datetime().nullable().meta({
    description: "When Discord last accepted a message",
  }),
  lastError: z.string().nullable().meta({
    description: "Why the last message could not be posted, null when it was",
  }),
});
export type AlertWebhook = z.infer<typeof AlertWebhookSchema>;

export const UpdateAlertWebhookSchema = z.object({
  url: AlertWebhookUrlSchema,
  enabled: z.boolean().default(false).meta({ description: "Whether the alerts are posted" }),
  content: z
    .string()
    .max(DISCORD_MESSAGE_MAX_LENGTH, `Keep it under ${DISCORD_MESSAGE_MAX_LENGTH} characters`)
    .meta({ description: "Text posted with every alert, where the mentions go" }),
  kinds: AlertWebhookKindsSchema,
  notifyResolved: z.boolean().default(false).meta({
    description: "Whether a message is also posted when an alert is resolved",
  }),
});
export type UpdateAlertWebhook = z.input<typeof UpdateAlertWebhookSchema>;
export type AlertWebhookSettings = z.output<typeof UpdateAlertWebhookSchema>;
