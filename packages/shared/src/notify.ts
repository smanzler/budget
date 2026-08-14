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

/**
 * Somebody claimed they paid you back.
 *
 * The one adversarial write in the app: `settlements.create` forces
 * `from_member_id` to the caller, so the only assertion anyone can make is "I
 * paid you" — the one that reduces their own debt. Telling the payee is what
 * makes that claim reviewable rather than silent.
 *
 * `amountCents` travels rather than a formatted string so the renderer owns the
 * money formatting, and `householdId` travels so a tap can switch to the
 * household the payment happened in.
 */
export const settlementRecordedSchema = z.object({
  type: z.literal("settlement_recorded"),
  data: z.object({
    settlementId: z.string(),
    householdId: z.string(),
    /** The payer's seat name — the payee may not know their user account. */
    fromDisplayName: z.string(),
    amountCents: z.number().int(),
    isoCurrencyCode: z.string(),
  }),
});

/**
 * A repayment was taken back.
 *
 * Void is scoped to the settlement's author *or* any household owner, so an
 * owner can reverse a payment somebody else recorded. Without this the other
 * party's balance silently moves back up.
 */
export const settlementVoidedSchema = z.object({
  type: z.literal("settlement_voided"),
  data: z.object({
    settlementId: z.string(),
    householdId: z.string(),
    /** Who voided it, which is not necessarily who recorded it. */
    voidedByDisplayName: z.string(),
    amountCents: z.number().int(),
    isoCurrencyCode: z.string(),
  }),
});

export const notificationPayloadSchema = z.discriminatedUnion("type", [
  systemMessageSchema,
  bankLoginRequiredSchema,
  settlementRecordedSchema,
  settlementVoidedSchema,
]);

export type NotificationPayload = z.infer<typeof notificationPayloadSchema>;
