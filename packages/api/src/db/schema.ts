import { sql } from "drizzle-orm";
import {
  check,
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  index,
  unique,
  uniqueIndex,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { users } from "./auth-schema";

/**
 * A shared expense group. Every expense in it uses `currency`, so amounts
 * inside a group are always directly comparable.
 *
 * The creator is recorded but holds no special powers: any member can rename
 * the group, invite others, and leave.
 */
export const Groups = pgTable("groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  currency: text("currency").notNull(),
  // Null once the creator deletes their account — the group outlives them.
  createdBy: uuid("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/**
 * Membership is soft: leaving stamps `left_at` rather than deleting the row, so
 * a former member's name still resolves on the expenses they were part of, and
 * rejoining is the same row again.
 */
export const GroupMembers = pgTable(
  "group_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => Groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
    leftAt: timestamp("left_at"),
  },
  (t) => [
    unique().on(t.groupId, t.userId),
    index("group_members_user_id_idx").on(t.userId),
  ],
);

/**
 * A shareable code that lets anyone holding it join the group until it expires
 * or is revoked. Codes are looked up case-insensitively after normalisation, so
 * they are stored in their canonical upper-case form.
 */
export const GroupInvites = pgTable(
  "group_invites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => Groups.id, { onDelete: "cascade" }),
    code: text("code").notNull().unique(),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at").notNull(),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("group_invites_group_id_idx").on(t.groupId)],
);

export const Expenses = pgTable(
  "expenses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => Groups.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    // Minor units of the group currency.
    totalMinor: integer("total_minor").notNull(),
    // Restrict: keep the ledger row if the user goes away.
    paidByUserId: uuid("paid_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    spentAt: timestamp("spent_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("expenses_group_id_spent_at_idx").on(t.groupId, t.spentAt)],
);

/**
 * A payment one member makes to another to bring their balances back together.
 * It moves no expense: it only records that the money changed hands.
 */
export const Settlements = pgTable(
  "settlements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => Groups.id, { onDelete: "cascade" }),
    // Restrict: keep the ledger row if the user goes away.
    fromUserId: uuid("from_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    toUserId: uuid("to_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    // Minor units of the group currency.
    amountMinor: integer("amount_minor").notNull(),
    settledAt: timestamp("settled_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("settlements_group_id_settled_at_idx").on(t.groupId, t.settledAt),
    check("settlements_amount_minor_positive", sql`${t.amountMinor} > 0`),
    check(
      "settlements_from_user_id_not_to_user_id",
      sql`${t.fromUserId} <> ${t.toUserId}`,
    ),
  ],
);

/**
 * The two sides of an expense or of a settlement: a positive amount is money a
 * user put in, a negative amount is money they used. The rows of one expense or
 * settlement add up to zero, and the rows of one user in one group add up to
 * their balance.
 */
export const LedgerEntries = pgTable(
  "ledger_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Kept on the row so a balance reads one table.
    groupId: uuid("group_id")
      .notNull()
      .references(() => Groups.id, { onDelete: "cascade" }),
    expenseId: uuid("expense_id").references(() => Expenses.id, {
      onDelete: "cascade",
    }),
    settlementId: uuid("settlement_id").references(() => Settlements.id, {
      onDelete: "cascade",
    }),
    // Restrict: keep the ledger row if the user goes away.
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    amountMinor: integer("amount_minor").notNull(),
  },
  (t) => [
    index("ledger_entries_group_id_user_id_idx").on(t.groupId, t.userId),
    index("ledger_entries_expense_id_idx").on(t.expenseId),
    index("ledger_entries_settlement_id_idx").on(t.settlementId),
    // A user uses money one time in an expense. Money they put in is a second row.
    uniqueIndex("ledger_entries_expense_id_user_id_used_idx")
      .on(t.expenseId, t.userId)
      .where(sql`${t.amountMinor} < 0`),
    uniqueIndex("ledger_entries_settlement_id_user_id_used_idx")
      .on(t.settlementId, t.userId)
      .where(sql`${t.amountMinor} < 0`),
    check(
      "ledger_entries_one_source",
      sql`(${t.expenseId} is null) <> (${t.settlementId} is null)`,
    ),
  ],
);

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

export * from "./auth-schema";
