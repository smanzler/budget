import { defineRelations } from "drizzle-orm";
import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
  Notifications: {
    user: r.one.users({
      from: r.Notifications.userId,
      to: r.users.id,
    }),
    deliveries: r.many.NotificationDeliveries({
      from: r.Notifications.id,
      to: r.NotificationDeliveries.notificationId,
    }),
  },
  NotificationDeliveries: {
    notification: r.one.Notifications({
      from: r.NotificationDeliveries.notificationId,
      to: r.Notifications.id,
    }),
  },
  PushTokens: {
    user: r.one.users({
      from: r.PushTokens.userId,
      to: r.users.id,
    }),
  },
}));
