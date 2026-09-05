import { defineRelations } from "drizzle-orm";
import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
  Groups: {
    expenses: r.many.Expenses({
      from: r.Groups.id,
      to: r.Expenses.groupId,
    }),
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
  Expenses: {
    group: r.one.Groups({
      from: r.Expenses.groupId,
      to: r.Groups.id,
    }),
    paidBy: r.one.users({
      from: r.Expenses.paidByUserId,
      to: r.users.id,
    }),
    creator: r.one.users({
      from: r.Expenses.createdBy,
      to: r.users.id,
    }),
    entries: r.many.LedgerEntries({
      from: r.Expenses.id,
      to: r.LedgerEntries.expenseId,
    }),
  },
  LedgerEntries: {
    expense: r.one.Expenses({
      from: r.LedgerEntries.expenseId,
      to: r.Expenses.id,
    }),
    group: r.one.Groups({
      from: r.LedgerEntries.groupId,
      to: r.Groups.id,
    }),
    user: r.one.users({
      from: r.LedgerEntries.userId,
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
