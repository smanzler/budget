import { and, eq, isNull, or } from "drizzle-orm";
import db from "../db";
import { HouseholdMembers, Households } from "../db/schema";

/** The seat a request acts as. Resolved from the session, never from input. */
export type Member = typeof HouseholdMembers.$inferSelect;

/**
 * better-auth's emailOTP writes `name || ""`, and the verify screen never sends
 * one, so `users.name` is empty for every user this app creates. Falling back
 * to the local part of the email is the difference between a members list that
 * reads "simanzler" and one that reads "".
 */
export const memberDisplayName = (user: {
  name?: string | null;
  email: string;
}) => user.name?.trim() || user.email.split("@")[0] || "Member";

/**
 * The household a user acts in, creating it on first use.
 *
 * Called from two places on purpose. The better-auth signup hook covers real
 * sign-ups, and `householdProcedure` covers everything else — `db/seed.ts`
 * writes users through drizzle-seed and bypasses better-auth entirely, so a
 * hook-only bootstrap would leave every seeded user permanently 403ing.
 *
 * Idempotent under concurrency: two simultaneous first requests both hit the
 * unique index on `households.created_by_user_id`, and the loser reads back the
 * winner's row instead of failing.
 */
export const ensureHousehold = async (user: {
  id: string;
  name?: string | null;
  email: string;
}): Promise<Member> => {
  const existing = await findActiveMember(user.id);
  if (existing) return existing;

  const displayName = memberDisplayName(user);

  return db.transaction(async (tx) => {
    await tx
      .insert(Households)
      .values({
        name: `${displayName}'s household`,
        createdByUserId: user.id,
      })
      .onConflictDoNothing({ target: Households.createdByUserId });

    // Read back rather than trusting RETURNING: `onConflictDoNothing` returns
    // no rows when the insert lost the race, and that is exactly the case we
    // need the id for.
    const household = await tx.query.Households.findFirst({
      where: { createdByUserId: user.id },
      columns: { id: true },
    });

    if (!household) {
      throw new Error(`failed to bootstrap a household for user ${user.id}`);
    }

    await tx
      .insert(HouseholdMembers)
      .values({
        householdId: household.id,
        userId: user.id,
        displayName,
        role: "owner",
        status: "active",
        joinedAt: new Date(),
      })
      .onConflictDoNothing({
        target: [HouseholdMembers.householdId, HouseholdMembers.userId],
      });

    const member = await tx.query.HouseholdMembers.findFirst({
      where: { householdId: household.id, userId: user.id },
    });

    if (!member) {
      throw new Error(`failed to bootstrap a member seat for user ${user.id}`);
    }

    if (member.status === "active") return member;

    // The insert above conflicts on `(household_id, user_id)`, which matches a
    // seat in ANY status — so a user whose only seats have been retired reads
    // one back and would then act as a `removed` member: invisible to
    // `splittableMembers`, filtered out of the client's own member list, yet
    // still carrying `role: 'owner'`. Reachable by joining another household
    // (which retires this seat) and later being removed from it.
    //
    // Safe to reactivate unconditionally: this household is by definition the
    // one this user created, so the seat is their own.
    const [revived] = await tx
      .update(HouseholdMembers)
      .set({ status: "active", removedAt: null, joinedAt: new Date() })
      .where(eq(HouseholdMembers.id, member.id))
      .returning();

    return revived ?? member;
  });
};

/**
 * v1 asserts a user is in exactly one household. Multi-household support is a
 * switcher on top of this lookup, not a schema change.
 */
const findActiveMember = (userId: string) =>
  db.query.HouseholdMembers.findFirst({
    where: { userId, status: "active" },
    // Deterministic if a second membership ever appears, so a user does not
    // silently flip between households between requests.
    orderBy: { createdAt: "asc" },
  });

/** A member as the clients see one, on a split, a balance or an activity row. */
export type MemberRef = {
  id: string;
  displayName: string;
  isYou: boolean;
  status: "invited" | "active" | "removed";
};

/**
 * Shapes a member for the wire, tolerating one that is no longer there.
 *
 * Every id the ledger and the splits reference must render with a name, and a
 * seat can be removed after it earned history — so the lookup is allowed to
 * miss, and the fallback is stated once here rather than at each call site.
 */
export const toMemberRef = (
  member:
    | { id: string; displayName: string; status: MemberRef["status"] }
    | undefined,
  fallbackId: string,
  youId: string,
): MemberRef => ({
  id: member?.id ?? fallbackId,
  // A removed seat still owns history, so it must still render with a name.
  displayName: member?.displayName ?? "Former member",
  isYou: (member?.id ?? fallbackId) === youId,
  status: member?.status ?? "removed",
});

/**
 * Members who can be assigned a share. `invited` seats count: the whole point
 * of a seat existing before its invite is accepted is that you can split with
 * that person today. `removed` seats do not — their history stays in the
 * ledger, but nothing new accrues to them.
 */
export const splittableMembers = (householdId: string) =>
  db
    .select()
    .from(HouseholdMembers)
    .where(
      and(
        eq(HouseholdMembers.householdId, householdId),
        or(
          eq(HouseholdMembers.status, "active"),
          eq(HouseholdMembers.status, "invited"),
        ),
        isNull(HouseholdMembers.removedAt),
      ),
    )
    .orderBy(HouseholdMembers.createdAt);
