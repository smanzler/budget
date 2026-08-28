import { defineRelations } from "drizzle-orm";
import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
  Groups: {
    creator: r.one.users({
      from: r.Groups.createdBy,
      to: r.users.id,
    }),
    members: r.many.GroupMembers({
      from: r.Groups.id,
      to: r.GroupMembers.groupId,
    }),
    invites: r.many.GroupInvites({
      from: r.Groups.id,
      to: r.GroupInvites.groupId,
    }),
  },
  GroupMembers: {
    group: r.one.Groups({
      from: r.GroupMembers.groupId,
      to: r.Groups.id,
    }),
    user: r.one.users({
      from: r.GroupMembers.userId,
      to: r.users.id,
    }),
  },
  GroupInvites: {
    group: r.one.Groups({
      from: r.GroupInvites.groupId,
      to: r.Groups.id,
    }),
    creator: r.one.users({
      from: r.GroupInvites.createdBy,
      to: r.users.id,
    }),
  },
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
