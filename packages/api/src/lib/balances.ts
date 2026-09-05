import { eq, sum } from "drizzle-orm";
import db from "../db/index";
import { LedgerEntries } from "../db/schema";

/**
 * The balance of every user in the group, keyed by user id. A positive amount
 * means the group owes them. A user with no entry is absent.
 *
 * The amounts add up to zero over the whole group.
 */
export async function groupNetBalances(groupId: string) {
  const rows = await db
    .select({
      userId: LedgerEntries.userId,
      netMinor: sum(LedgerEntries.amountMinor).mapWith(Number),
    })
    .from(LedgerEntries)
    .where(eq(LedgerEntries.groupId, groupId))
    .groupBy(LedgerEntries.userId);

  return new Map(rows.map((row) => [row.userId, row.netMinor ?? 0]));
}

/** The same balance for one user, keyed by group id. */
export async function userNetBalancesByGroup(userId: string) {
  const rows = await db
    .select({
      groupId: LedgerEntries.groupId,
      netMinor: sum(LedgerEntries.amountMinor).mapWith(Number),
    })
    .from(LedgerEntries)
    .where(eq(LedgerEntries.userId, userId))
    .groupBy(LedgerEntries.groupId);

  return new Map(rows.map((row) => [row.groupId, row.netMinor ?? 0]));
}
