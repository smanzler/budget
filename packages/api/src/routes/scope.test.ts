import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import db from "../db";
import {
  BankAccounts,
  HouseholdMembers,
  Households,
  PlaidItems,
  TransactionSplits,
  Transactions,
  users,
} from "../db/schema";
import { ensureHousehold } from "../lib/household";
import { router } from "../lib/trpc";
import { balancesRouter } from "./balances";
import { householdRouter } from "./household";
import { settlementsRouter } from "./settlements";
import { transactionsRouter } from "./transactions";

/**
 * Composed here rather than importing `appRouter`, which reaches the `plaid`
 * router and through it `lib/boss.ts` — that module calls `boss.start()` at
 * import time, so merely importing the real app router would spin up a job
 * queue inside the test process. None of the four routers under test touch it.
 */
const appRouter = router({
  balances: balancesRouter,
  household: householdRouter,
  settlements: settlementsRouter,
  transactions: transactionsRouter,
});

/**
 * The leak test.
 *
 * Two households are set up with real data, then every read procedure is called
 * as each user and asserted to see none of the other's. It cannot be written
 * against a mock — the thing under test is whether a `WHERE` clause is actually
 * present in the SQL — so it is opt-in on a live database:
 *
 *   INTEGRATION_DATABASE_URL=postgresql://budget:...@localhost:5432/budget pnpm test
 *
 * Unlike the ledger tests these cannot run inside a rolled-back transaction:
 * `createCaller` goes through the module-level `db`, which would not see
 * uncommitted rows. Everything it creates is namespaced and deleted in
 * `afterAll` instead.
 */
const url = process.env.INTEGRATION_DATABASE_URL;

const STAMP = `scope-test-${process.pid}`;
const householdIds: string[] = [];

type User = typeof users.$inferSelect;

const caller = (user: User) =>
  appRouter.createCaller({
    req: {} as never,
    res: {} as never,
    user: user as never,
    session: { id: "session", userId: user.id } as never,
    // One caller is one request, so the real per-request memo would be a no-op
    // here — every call goes through the same lookup the middleware makes.
    resolveMember: ensureHousehold,
  });

/** A user with a household, a bank account and one $100 transaction. */
const setUpHousehold = async (label: string) => {
  const [user] = await db!
    .insert(users)
    .values({
      name: "",
      email: `${STAMP}-${label}@example.com`,
      emailVerified: true,
    })
    .returning();

  const api = caller(user!);
  const household = await api.household.get();
  householdIds.push(household.id);

  const [item] = await db!
    .insert(PlaidItems)
    .values({
      householdId: household.id,
      userId: user!.id,
      ownerMemberId: household.myMemberId,
      plaidItemId: `${STAMP}-${label}-item`,
      accessToken: "x",
      status: "active",
    })
    .returning();

  const [account] = await db!
    .insert(BankAccounts)
    .values({
      householdId: household.id,
      plaidItemId: item!.id,
      ownerMemberId: household.myMemberId,
      plaidAccountId: `${STAMP}-${label}-acct`,
      name: "Amex",
      mask: "4242",
    })
    .returning();

  const [transaction] = await db!
    .insert(Transactions)
    .values({
      householdId: household.id,
      bankAccountId: account!.id,
      creditorMemberId: household.myMemberId,
      plaidTransactionId: `${STAMP}-${label}-txn`,
      amount: "100.00",
      date: "2026-08-03",
      name: "Luigi's",
      isoCurrencyCode: "USD",
    })
    .returning();

  await db.insert(TransactionSplits).values({
    householdId: household.id,
    transactionId: transaction!.id,
    memberId: household.myMemberId,
    weight: 1,
    amountCents: 10000,
  });

  return { user: user!, api, household, transaction: transaction! };
};

let alice: Awaited<ReturnType<typeof setUpHousehold>>;
let bob: Awaited<ReturnType<typeof setUpHousehold>>;

beforeAll(async () => {
  if (!url) return;
  alice = await setUpHousehold("alice");
  bob = await setUpHousehold("bob");
});

afterAll(async () => {
  if (!url) return;

  // `households.created_by_user_id` is SET NULL rather than CASCADE, so
  // deleting the users would strand the households. Drop those first.
  if (householdIds.length > 0) {
    await db.delete(Households).where(inArray(Households.id, householdIds));
  }
  // Only ever the two users this file created, matched on the run-scoped stamp.
  await db
    .delete(users)
    .where(
      inArray(users.email, [
        `${STAMP}-alice@example.com`,
        `${STAMP}-bob@example.com`,
      ]),
    );

  await db.$client.end();
});

describe.skipIf(!url)("household scoping", () => {
  it("gives each user their own household", () => {
    expect(alice.household.id).not.toBe(bob.household.id);
    expect(alice.household.members).toHaveLength(1);
    expect(bob.household.members).toHaveLength(1);
  });

  it("shows each user only their own transactions", async () => {
    const seen = await alice.api.transactions.list({ limit: 100 });

    expect(seen.items.map((row) => row.id)).toContain(alice.transaction.id);
    expect(seen.items.map((row) => row.id)).not.toContain(bob.transaction.id);
  });

  it("refuses to read another household's transaction by id", async () => {
    await expect(
      alice.api.transactions.get({ transactionId: bob.transaction.id }),
    ).rejects.toThrow();
  });

  it("refuses to split another household's transaction", async () => {
    await expect(
      alice.api.transactions.setSplit({
        transactionId: bob.transaction.id,
        method: "shares",
        parts: [{ memberId: alice.household.myMemberId, weight: 1 }],
      }),
    ).rejects.toThrow();

    // And nothing was written on the way to failing.
    const splits = await db!
      .select()
      .from(TransactionSplits)
      .where(eq(TransactionSplits.transactionId, bob.transaction.id));

    expect(splits).toHaveLength(1);
    expect(splits[0]!.memberId).toBe(bob.household.myMemberId);
  });

  it("refuses to reassign an account in another household", async () => {
    const accounts = await db!
      .select({ id: BankAccounts.id })
      .from(BankAccounts)
      .where(eq(BankAccounts.householdId, bob.household.id));

    await expect(
      alice.api.household.setAccountOwner({
        bankAccountId: accounts[0]!.id,
        memberId: alice.household.myMemberId,
      }),
    ).rejects.toThrow();
  });

  it("refuses to settle up with a member of another household", async () => {
    await expect(
      alice.api.settlements.create({
        settlementId: crypto.randomUUID(),
        toMemberId: bob.household.myMemberId,
        amountCents: 5000,
        settledOn: "2026-09-20",
      }),
    ).rejects.toThrow();
  });

  it("keeps balances and members apart", async () => {
    const balances = await alice.api.balances.summary();
    const members = await db!
      .select({ id: HouseholdMembers.id })
      .from(HouseholdMembers)
      .where(eq(HouseholdMembers.householdId, alice.household.id));

    expect(balances.pairs).toHaveLength(0);
    expect(members.map((m) => m.id)).not.toContain(bob.household.myMemberId);
  });
});
