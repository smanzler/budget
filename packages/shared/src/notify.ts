import { z } from "zod";

// Notification payloads are a discriminated union so the API can render a
// title/body per type and the client can narrow on `type` when handling a tap.
// Add a schema per notification type your app sends.
export const systemMessageSchema = z.object({
  type: z.literal("system_message"),
  data: z.object({
    message: z.string(),
  }),
});

/** A bank connection expired — the user has to re-authenticate through Link. */
export const bankLoginRequiredSchema = z.object({
  type: z.literal("bank_login_required"),
  data: z.object({
    itemId: z.string(),
    institutionName: z.string().nullable(),
  }),
});

export const notificationPayloadSchema = z.discriminatedUnion("type", [
  systemMessageSchema,
  bankLoginRequiredSchema,
]);

export type NotificationPayload = z.infer<typeof notificationPayloadSchema>;
