import { PgBoss } from "pg-boss";
import { env } from "../env";
import { z } from "zod";
import db from "../db";
import {
  NotificationDeliveries,
  Notifications,
  PushTokens,
} from "../db/schema";
import { eq } from "drizzle-orm";
import { expo, buildPushMessage, getTicketOutcome } from "./expo";

export const boss = new PgBoss(env.DATABASE_URL);
await boss.start();
await boss.createQueue("notify.mobile", {
  retryLimit: 5,
  retryBackoff: true,
  retryDelay: 1,
  retryDelayMax: 300,
});

boss.work("notify.mobile", async ([job]) => {
  const { deliveryId } = z.object({ deliveryId: z.uuid() }).parse(job?.data);

  const [result] = await db
    .select()
    .from(NotificationDeliveries)
    .leftJoin(
      Notifications,
      eq(Notifications.id, NotificationDeliveries.notificationId),
    )
    .where(eq(NotificationDeliveries.id, deliveryId));

  if (!result || !result.notifications) throw new Error();

  const delivery = result.notification_deliveries;
  const { title, body, data } = result.notifications;

  const message = delivery.deviceToken
    ? buildPushMessage({
        token: delivery.deviceToken,
        title,
        body,
        data: data as Record<string, unknown> | null,
      })
    : null;

  if (!message) {
    await db
      .update(NotificationDeliveries)
      .set({
        status: "failed",
        lastError: "Missing or invalid Expo push token",
        attempts: delivery.attempts + 1,
      })
      .where(eq(NotificationDeliveries.id, deliveryId));
    return;
  }

  try {
    const [ticket] = await expo.sendPushNotificationsAsync([message]);
    if (!ticket) throw new Error("No ticket returned from Expo");

    const outcome = getTicketOutcome(ticket);

    await db
      .update(NotificationDeliveries)
      .set({
        status: outcome.status,
        lastError: outcome.status === "failed" ? outcome.lastError : null,
        sentAt: outcome.status === "sent" ? new Date() : undefined,
        attempts: delivery.attempts + 1,
      })
      .where(eq(NotificationDeliveries.id, deliveryId));

    if (outcome.status === "failed" && outcome.invalidToken) {
      await db
        .delete(PushTokens)
        .where(eq(PushTokens.token, delivery.deviceToken!));
    }
  } catch (err) {
    await db
      .update(NotificationDeliveries)
      .set({
        status: "failed",
        lastError: err instanceof Error ? err.message : "Unknown error",
        attempts: delivery.attempts + 1,
      })
      .where(eq(NotificationDeliveries.id, deliveryId));

    throw err;
  }
});
