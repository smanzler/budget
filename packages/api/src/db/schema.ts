import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  index,
  unique,
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

// The amounts add up to the total of the expense.
export const ExpenseSplits = pgTable(
  "expense_splits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => Expenses.id, { onDelete: "cascade" }),
    // Restrict: keep the ledger row if the user goes away.
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    amountMinor: integer("amount_minor").notNull(),
  },
  (t) => [
    unique().on(t.expenseId, t.userId),
    index("expense_splits_user_id_idx").on(t.userId),
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
