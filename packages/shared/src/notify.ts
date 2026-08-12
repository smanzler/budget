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

export const notificationPayloadSchema = z.discriminatedUnion("type", [
  systemMessageSchema,
]);

export type NotificationPayload = z.infer<typeof notificationPayloadSchema>;
