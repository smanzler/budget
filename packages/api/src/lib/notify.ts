import { eq } from "drizzle-orm";
import db from "../db";
import {
  NotificationDeliveries,
  Notifications,
  PushTokens,
} from "../db/schema";
import {
  notificationPayloadSchema,
  type NotificationPayload,
} from "@settle/shared";
import { boss } from "./boss";

const renderNotification = (
  payload: NotificationPayload,
): { title: string; body: string } => {
  switch (payload.type) {
    case "system_message":
      return {
        title: "Settle",
        body: payload.data.message,
      };
  }
};

export const notify = async ({
  userId,
  payload,
  dedupeKey,
}: {
  userId: string;
  payload: NotificationPayload;
  dedupeKey?: string;
}) => {
  const parsed = notificationPayloadSchema.parse(payload);
  const { title, body } = renderNotification(parsed);

  const [notification] = await db
    .insert(Notifications)
    .values({
      userId,
      type: parsed.type,
      data: parsed.data,
      title,
      body,
      dedupeKey,
    })
    .onConflictDoNothing({
      target: [Notifications.userId, Notifications.dedupeKey],
    })
    .returning();

  if (!notification) return null; // duplicate event — already notified, no-op

  const tokens = await db
    .select()
    .from(PushTokens)
    .where(eq(PushTokens.userId, userId));

  for (const token of tokens) {
    const { token: deviceToken } = token;

    const [delivery] = await db
      .insert(NotificationDeliveries)
      .values({
        notificationId: notification.id,
        channel: "mobile",
        deviceToken,
      })
      .returning();

    if (!delivery) throw new Error();

    await boss.send("notify.mobile", { deliveryId: delivery.id });
  }

  return notification;
};
