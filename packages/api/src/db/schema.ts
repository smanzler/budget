import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  unique,
  jsonb,
  pgEnum,
  index,
  boolean,
  numeric,
  date,
} from "drizzle-orm/pg-core";
import { users } from "./auth-schema";

export const Notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    data: jsonb("data"),
    dedupeKey: text("dedupe_key"),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.userId, t.dedupeKey)],
);

export const channelEnum = pgEnum("channel", ["email", "mobile"]);
export const statusEnum = pgEnum("status", ["pending", "sent", "failed"]);

export const NotificationDeliveries = pgTable("notification_deliveries", {
  id: uuid("id").defaultRandom().primaryKey(),
  notificationId: uuid("notification_id")
    .notNull()
    .references(() => Notifications.id, { onDelete: "cascade" }),
  channel: channelEnum().notNull(),
  deviceToken: text("device_token"),
  status: statusEnum().notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  sentAt: timestamp("sent_at"),
});

export const PushTokens = pgTable("push_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * `syncing` is load-bearing for the UI: it lets the transaction list say
 * "fetching your transactions" on first connect instead of "no transactions",
 * which otherwise reads as a bug.
 */
export const plaidItemStatusEnum = pgEnum("plaid_item_status", [
  "syncing",
  "active",
  "login_required",
  "error",
]);

/** One row per connected institution ("Item" in Plaid's vocabulary). */
export const PlaidItems = pgTable(
  "plaid_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    plaidItemId: text("plaid_item_id").notNull().unique(),
    /** AES-256-GCM ciphertext — see lib/crypto.ts. Never leaves the server. */
    accessToken: text("access_token").notNull(),
    institutionId: text("institution_id"),
    institutionName: text("institution_name"),
    institutionLogoUrl: text("institution_logo_url"),
    /** Plaid `/transactions/sync` cursor. Null means never synced. */
    cursor: text("cursor"),
    status: plaidItemStatusEnum().notNull().default("syncing"),
    lastSyncedAt: timestamp("last_synced_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("plaid_items_user_id_idx").on(t.userId)],
);

/**
 * Named `BankAccounts`, not `Accounts` — better-auth already owns `accounts`,
 * which is re-exported from this file.
 */
export const BankAccounts = pgTable(
  "bank_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    plaidItemId: uuid("plaid_item_id")
      .notNull()
      .references(() => PlaidItems.id, { onDelete: "cascade" }),
    plaidAccountId: text("plaid_account_id").notNull().unique(),
    name: text("name").notNull(),
    officialName: text("official_name"),
    type: text("type"),
    subtype: text("subtype"),
    mask: text("mask"),
    currentBalance: numeric("current_balance", { precision: 12, scale: 2 }),
    availableBalance: numeric("available_balance", { precision: 12, scale: 2 }),
    isoCurrencyCode: text("iso_currency_code"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("bank_accounts_user_id_idx").on(t.userId),
    index("bank_accounts_plaid_item_id_idx").on(t.plaidItemId),
  ],
);

/**
 * Amounts are stored verbatim from Plaid: **positive means money left the
 * account**. Keeping Plaid's sign makes re-syncs byte-idempotent and makes rows
 * match the Plaid dashboard when debugging. Exactly one client module is
 * allowed to interpret it (mobile `features/transactions/lib/format.ts`).
 *
 * `numeric` is returned by Drizzle as a **string** — never do float math on it.
 */
export const Transactions = pgTable(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Denormalized so listing needs no join. */
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bankAccountId: uuid("bank_account_id")
      .notNull()
      .references(() => BankAccounts.id, { onDelete: "cascade" }),
    /** The sync idempotency key. */
    plaidTransactionId: text("plaid_transaction_id").notNull().unique(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    isoCurrencyCode: text("iso_currency_code"),
    /** Drizzle returns `date` columns as `YYYY-MM-DD` strings. */
    date: date("date").notNull(),
    authorizedDate: date("authorized_date"),
    /** Raw bank description. */
    name: text("name").notNull(),
    merchantName: text("merchant_name"),
    /** Personal finance category, primary. */
    category: text("category"),
    categoryDetailed: text("category_detailed"),
    paymentChannel: text("payment_channel"),
    pending: boolean("pending").notNull().default(false),
    logoUrl: text("logo_url"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // Serves the keyset-paginated list query.
    index("transactions_user_id_date_id_idx").on(
      t.userId,
      t.date.desc(),
      t.id.desc(),
    ),
    index("transactions_bank_account_id_idx").on(t.bankAccountId),
  ],
);

export * from "./auth-schema";
