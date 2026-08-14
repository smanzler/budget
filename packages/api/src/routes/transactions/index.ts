import { toCents } from "@budget/shared";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import db from "../../db";
import { BankAccounts, TransactionSplits, Transactions } from "../../db/schema";
import {
  splittableMembers,
  toMemberRef,
  type Member,
  type MemberRef,
} from "../../lib/household";
import { decodeCursor, paginate } from "../../lib/keyset";
import { postShareDeltas, shareTargetFor, type Tx } from "../../lib/ledger";
import {
  assertSplitsBalance,
  ownerOnly,
  partsFromWeights,
  splitsToPairs,
  writeSplits,
  type SplitMethod,
  type SplitPart,
} from "../../lib/splits";
import { householdProcedure, router } from "../../lib/trpc";

/**
 * A private account is visible only to its owner, and an excluded account (a
 * muted duplicate of a joint account someone else already linked) is visible to
 * nobody.
 *
 * Both are applied *inside* the SQL rather than filtered afterwards, so
 * `LIMIT limit + 1` still returns `limit + 1` **matching** rows and the
 * existing `hasMore` logic keeps working untouched.
 */
const visibleToMember = (householdId: string, memberId: string) =>
  and(
    eq(Transactions.householdId, householdId),
    isNull(BankAccounts.excludedAt),
    or(
      eq(Transactions.isPrivate, false),
      eq(Transactions.creditorMemberId, memberId),
    ),
  );

export const transactionsRouter = router({
  list: householdProcedure
    // Deliberately a plain object, not `z.strictObject`: the tanstack-react-query
    // integration injects `direction` into the input on every infinite fetch,
    // and a strict schema would reject it.
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
        accountId: z.uuid().optional(),
      }),
    )
    .query(async (opts) => {
      const { householdId, member } = opts.ctx;
      const { limit, cursor, accountId } = opts.input;

      const keyset = decodeCursor(cursor);

      // The member list depends on neither the page nor the splits, so it rides
      // alongside the page rather than adding a round trip after it.
      const [rows, members] = await Promise.all([
        db
          .select({
            id: Transactions.id,
            amount: Transactions.amount,
            isoCurrencyCode: Transactions.isoCurrencyCode,
            date: Transactions.date,
            name: Transactions.name,
            merchantName: Transactions.merchantName,
            category: Transactions.category,
            categoryDetailed: Transactions.categoryDetailed,
            pending: Transactions.pending,
            logoUrl: Transactions.logoUrl,
            bankAccountId: Transactions.bankAccountId,
            accountName: BankAccounts.name,
            accountMask: BankAccounts.mask,
            creditorMemberId: Transactions.creditorMemberId,
            splitMethod: Transactions.splitMethod,
            splitsStale: Transactions.splitsStale,
          })
          .from(Transactions)
          .innerJoin(
            BankAccounts,
            eq(BankAccounts.id, Transactions.bankAccountId),
          )
          .where(
            and(
              visibleToMember(householdId, member.id),
              accountId ? eq(Transactions.bankAccountId, accountId) : undefined,
              keyset
                ? // Row-wise comparison, so it rides the (household_id, date desc,
                  // id desc) index in a single pass.
                  sql`(${Transactions.date}, ${Transactions.id}) < (${keyset.date}::date, ${keyset.id}::uuid)`
                : undefined,
            ),
          )
          .orderBy(desc(Transactions.date), desc(Transactions.id))
          .limit(limit + 1),
        splittableMembers(householdId),
      ]);

      const { items, nextCursor } = paginate(rows, limit, (row) => ({
        date: row.date,
        id: row.id,
      }));

      const attribution = await hydrateAttribution(
        members,
        member.id,
        householdId,
        items.map((row) => row.id),
      );

      return {
        items: items.map((row) => ({
          ...row,
          ...(attribution.get(row.id) ?? { yourShare: null, participants: [] }),
        })),
        nextCursor,
      };
    }),

  get: householdProcedure
    .input(z.object({ transactionId: z.uuid() }))
    .query(async (opts) => {
      const { householdId, member } = opts.ctx;

      const [row] = await db
        .select({
          id: Transactions.id,
          amount: Transactions.amount,
          isoCurrencyCode: Transactions.isoCurrencyCode,
          date: Transactions.date,
          name: Transactions.name,
          merchantName: Transactions.merchantName,
          category: Transactions.category,
          pending: Transactions.pending,
          logoUrl: Transactions.logoUrl,
          creditorMemberId: Transactions.creditorMemberId,
          splitMethod: Transactions.splitMethod,
          splitsStale: Transactions.splitsStale,
          accountId: BankAccounts.id,
          accountName: BankAccounts.name,
          accountMask: BankAccounts.mask,
        })
        .from(Transactions)
        .innerJoin(
          BankAccounts,
          eq(BankAccounts.id, Transactions.bankAccountId),
        )
        .where(
          and(
            eq(Transactions.id, opts.input.transactionId),
            visibleToMember(householdId, member.id),
          ),
        );

      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Transaction not found",
        });
      }

      const [splits, members] = await Promise.all([
        db
          .select({
            memberId: TransactionSplits.memberId,
            weight: TransactionSplits.weight,
            amountCents: TransactionSplits.amountCents,
          })
          .from(TransactionSplits)
          .where(eq(TransactionSplits.transactionId, row.id)),
        splittableMembers(householdId),
      ]);

      const byId = new Map(members.map((m) => [m.id, m]));

      return {
        transaction: row,
        currency: row.isoCurrencyCode,
        splits: splits.map((split) => ({
          member: toMemberRef(
            byId.get(split.memberId),
            split.memberId,
            member.id,
          ),
          weight: split.weight,
          amountCents: split.amountCents,
        })),
        // Everyone who *could* be given a share, so the editor can offer them.
        members: members.map((m) => toMemberRef(m, m.id, member.id)),
      };
    }),

  /**
   * Replace a transaction's split.
   *
   * `shares` sends weights and the **server** runs the allocator — the client
   * never rounds, so it cannot disagree with what gets stored. `exact` sends
   * cents and is rejected unless they sum to the amount exactly; the client
   * mirrors the same invariant with the shared `allocate`, so this is a
   * backstop rather than the primary feedback path.
   */
  setSplit: householdProcedure
    .input(
      z.union([
        z.object({
          transactionId: z.uuid(),
          method: z.literal("shares"),
          parts: z
            .array(
              z.object({
                memberId: z.uuid(),
                weight: z.int().min(1).max(1000),
              }),
            )
            .min(1),
        }),
        z.object({
          transactionId: z.uuid(),
          method: z.literal("exact"),
          parts: z
            .array(
              z.object({
                memberId: z.uuid(),
                /** A magnitude — the server applies the transaction's sign. */
                amountCents: z.int().min(0),
              }),
            )
            .min(1),
        }),
      ]),
    )
    .mutation(async (opts) => {
      const { householdId, member } = opts.ctx;
      const input = opts.input;

      // The member list doesn't depend on the transaction, so the two reads go
      // out together — this is the most latency-visible tap in the feature.
      const [transaction, members] = await Promise.all([
        loadEditable(householdId, member.id, input.transactionId),
        splittableMembers(householdId),
      ]);
      const totalCents = toCents(transaction.amount);

      // `splittableMembers` is already exactly the active-and-invited set.
      const allowed = new Set(members.map((m) => m.id));

      for (const part of input.parts) {
        if (!allowed.has(part.memberId)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "That person is not a member of this household",
          });
        }
      }

      if (
        new Set(input.parts.map((p) => p.memberId)).size !== input.parts.length
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A member can only appear once in a split",
        });
      }

      let parts: SplitPart[];

      if (input.method === "shares") {
        parts = partsFromWeights(totalCents, input.parts);
      } else {
        // Magnitudes in, signed cents out: the split of a refund is the split
        // of the purchase with every share negated, and asking the client to
        // reason about Plaid's sign convention is how the two ends drift apart.
        const sign = totalCents < 0 ? -1 : 1;
        const supplied = input.parts.reduce(
          (sum, part) => sum + part.amountCents,
          0,
        );

        if (supplied !== Math.abs(totalCents)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Shares must add up to the transaction amount — off by ${
              Math.abs(totalCents) - supplied
            } cents`,
          });
        }

        parts = input.parts.map((part) => ({
          memberId: part.memberId,
          weight: 1,
          amountCents: part.amountCents === 0 ? 0 : sign * part.amountCents,
        }));
      }

      // The payer is always a participant, so the editor always has a row for
      // them and a split never has to special-case "and the rest".
      if (
        !parts.some((part) => part.memberId === transaction.creditorMemberId)
      ) {
        parts = [
          ...parts,
          { memberId: transaction.creditorMemberId, weight: 1, amountCents: 0 },
        ];
      }

      assertSplitsBalance(transaction.amount, parts, "setSplit");

      await db.transaction((tx) =>
        applySplit(tx, {
          householdId,
          actorMemberId: member.id,
          transaction,
          method: input.method,
          parts,
        }),
      );

      return { transactionId: transaction.id, parts };
    }),

  /** Back to the whole amount on the payer — the "Just me" shortcut. */
  resetSplit: householdProcedure
    .input(z.object({ transactionId: z.uuid() }))
    .mutation(async (opts) => {
      const { householdId, member } = opts.ctx;

      const transaction = await loadEditable(
        householdId,
        member.id,
        opts.input.transactionId,
      );
      const { parts } = ownerOnly(
        transaction.creditorMemberId,
        toCents(transaction.amount),
      );

      // The payer's own share produces no pair, so this posts an empty target —
      // which drains every pair already posted for this ref to exactly zero,
      // and that is what "nobody owes anything for this" means.
      await db.transaction((tx) =>
        applySplit(tx, {
          householdId,
          actorMemberId: member.id,
          transaction,
          method: "owner",
          parts,
        }),
      );

      return { transactionId: transaction.id };
    }),
});

/**
 * The whole write behind a split: the rows, the stamp on the transaction, and
 * the ledger deltas that follow from them.
 *
 * `setSplit` and `resetSplit` differ only in the parts they compute and the
 * method they record. Keeping the three statements — and the order they run in
 * — in one place is what stops the two paths from drifting, and gives the next
 * writer of a split something to call rather than a sequence to reconstruct.
 */
const applySplit = async (
  tx: Tx,
  args: {
    householdId: string;
    actorMemberId: string;
    transaction: Awaited<ReturnType<typeof loadEditable>>;
    method: SplitMethod;
    parts: SplitPart[];
  },
) => {
  const { householdId, actorMemberId, transaction, method, parts } = args;

  await writeSplits(tx, {
    householdId,
    transactionId: transaction.id,
    parts,
  });

  await tx
    .update(Transactions)
    .set({
      splitMethod: method,
      // The human has just resolved whatever Plaid changed.
      splitsStale: false,
      splitUpdatedAt: new Date(),
      splitUpdatedByMemberId: actorMemberId,
    })
    .where(
      and(
        eq(Transactions.id, transaction.id),
        eq(Transactions.householdId, householdId),
      ),
    );

  await postShareDeltas(tx, {
    householdId,
    actorMemberId,
    targets: [
      shareTargetFor(
        transaction,
        transaction.currency,
        splitsToPairs(transaction.creditorMemberId, parts),
      ),
    ],
  });
};

/**
 * Loads a transaction for editing, refusing the cases where a split would be
 * meaningless or wrong.
 */
const loadEditable = async (
  householdId: string,
  memberId: string,
  transactionId: string,
) => {
  const [row] = await db
    .select({
      id: Transactions.id,
      plaidTransactionId: Transactions.plaidTransactionId,
      amount: Transactions.amount,
      date: Transactions.date,
      name: Transactions.name,
      merchantName: Transactions.merchantName,
      isoCurrencyCode: Transactions.isoCurrencyCode,
      creditorMemberId: Transactions.creditorMemberId,
      excludedAt: BankAccounts.excludedAt,
      currency: sql<string>`(select default_currency from households where id = ${householdId})`,
    })
    .from(Transactions)
    .innerJoin(BankAccounts, eq(BankAccounts.id, Transactions.bankAccountId))
    .where(
      and(
        eq(Transactions.id, transactionId),
        // The same predicate the reads use, privacy included. Without it a
        // member who cannot see a private account's rows could still split
        // one — and read its exact amount back out of the "off by N cents"
        // refusal. The excluded-account case is refused below instead, because
        // that one has an explanation worth giving.
        or(
          eq(Transactions.isPrivate, false),
          eq(Transactions.creditorMemberId, memberId),
        ),
        eq(Transactions.householdId, householdId),
      ),
    );

  if (!row) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Transaction not found",
    });
  }

  if (row.excludedAt !== null) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "This account is hidden as a duplicate",
    });
  }

  // Entries carry a single currency and balances group by it; a split across
  // two currencies would need a rate, and a wrong rate is worse than a refusal.
  if (row.isoCurrencyCode !== null && row.isoCurrencyCode !== row.currency) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `Only ${row.currency} transactions can be split`,
    });
  }

  return row;
};

/**
 * Stitches attribution onto a page of transactions with one extra query.
 *
 * Skipped entirely for a household of one: a solo user gets byte-identical
 * behaviour to before this feature existed, and zero extra round trips.
 */
const hydrateAttribution = async (
  members: readonly Member[],
  youId: string,
  householdId: string,
  transactionIds: string[],
) => {
  const byTransaction = new Map<
    string,
    { yourShare: number | null; participants: MemberRef[] }
  >();

  if (transactionIds.length === 0) return byTransaction;
  if (members.length <= 1) return byTransaction;

  const byId = new Map(members.map((m) => [m.id, m]));

  const splits = await db
    .select({
      transactionId: TransactionSplits.transactionId,
      memberId: TransactionSplits.memberId,
      amountCents: TransactionSplits.amountCents,
    })
    .from(TransactionSplits)
    .where(
      and(
        eq(TransactionSplits.householdId, householdId),
        inArray(TransactionSplits.transactionId, transactionIds),
      ),
    );

  for (const split of splits) {
    const entry = byTransaction.get(split.transactionId) ?? {
      yourShare: null,
      participants: [],
    };

    entry.participants.push(
      toMemberRef(byId.get(split.memberId), split.memberId, youId),
    );

    if (split.memberId === youId) entry.yourShare = split.amountCents;

    byTransaction.set(split.transactionId, entry);
  }

  // A split that is entirely yours is not attribution — the client renders
  // nothing, which is what keeps a shared household's list quiet.
  for (const [transactionId, entry] of byTransaction) {
    if (entry.participants.length <= 1) {
      byTransaction.set(transactionId, { yourShare: null, participants: [] });
    }
  }

  return byTransaction;
};
