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
  PlaidItems: {
    user: r.one.users({
      from: r.PlaidItems.userId,
      to: r.users.id,
    }),
    accounts: r.many.BankAccounts({
      from: r.PlaidItems.id,
      to: r.BankAccounts.plaidItemId,
    }),
  },
  BankAccounts: {
    user: r.one.users({
      from: r.BankAccounts.userId,
      to: r.users.id,
    }),
    plaidItem: r.one.PlaidItems({
      from: r.BankAccounts.plaidItemId,
      to: r.PlaidItems.id,
    }),
    transactions: r.many.Transactions({
      from: r.BankAccounts.id,
      to: r.Transactions.bankAccountId,
    }),
  },
  Transactions: {
    user: r.one.users({
      from: r.Transactions.userId,
      to: r.users.id,
    }),
    bankAccount: r.one.BankAccounts({
      from: r.Transactions.bankAccountId,
      to: r.BankAccounts.id,
    }),
  },
}));
