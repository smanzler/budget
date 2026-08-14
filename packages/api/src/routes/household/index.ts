import { fromCents } from "@budget/shared";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, gt, isNull, ne, sql } from "drizzle-orm";
import type { PgUpdateSetSource } from "drizzle-orm/pg-core";
import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import db from "../../db";
import {
  BankAccounts,
  HouseholdInvites,
  HouseholdMembers,
  Households,
  LedgerEntries,
  Transactions,
  users,
} from "../../db/schema";
import { lockHousehold } from "../../lib/ledger";
import { toIso } from "../../lib/serialize";
import {
  householdProcedure,
  ownerProcedure,
  protectedProcedure,
  router,
} from "../../lib/trpc";

/** `YYYY-MM-DD` — the shape every `date` column in this schema round-trips. */
const today = () => new Date().toISOString().slice(0, 10);

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Base32 minus every glyph a human misreads off a screen: no 0/O, no 1/I/L.
 * That leaves 31 symbols — one short of a power of two, which is why the code
 * below rejects out-of-range draws instead of taking a modulo, since a modulo
 * would quietly bias the head of the alphabet.
 */
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 10;

const inviteCode = () => {
  let code = "";

  while (code.length < CODE_LENGTH) {
    for (const byte of randomBytes(CODE_LENGTH)) {
      const index = byte & 31;
      if (index >= CODE_ALPHABET.length) continue;

      code += CODE_ALPHABET[index];
      if (code.length === CODE_LENGTH) break;
    }
  }

  return code;
};

/**
 * "Empty" means nothing anyone could lose by walking away from it: no bank
 * connections, no transactions, no ledger history, nobody else in the seat list.
 * Anything more and moving households has to be a deliberate act rather than a
 * side effect of tapping a link — the old household is not deleted here, and its
 * data would simply become unreachable.
 */
const householdHasData = async (
  householdId: string,
  exceptMemberId: string,
) => {
  const { rows } = await db.execute<{ has_data: boolean }>(sql`
    select
      exists (select 1 from plaid_items where household_id = ${householdId})
      or exists (select 1 from transactions where household_id = ${householdId})
      or exists (select 1 from ledger_entries where household_id = ${householdId})
      or exists (
        select 1 from household_members
        where household_id = ${householdId} and id <> ${exceptMemberId}
      ) as has_data
  `);

  // Refuse when the probe itself failed to answer.
  return rows[0]?.has_data ?? true;
};

export const householdRouter = router({
  get: householdProcedure.query(async (opts) => {
    const { householdId, member } = opts.ctx;

    const household = await db.query.Households.findFirst({
      where: { id: householdId },
      columns: { id: true, name: true, defaultCurrency: true },
      with: {
        members: {
          columns: { id: true, displayName: true, status: true, role: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!household) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Household not found",
      });
    }

    return {
      id: household.id,
      name: household.name,
      defaultCurrency: household.defaultCurrency,
      myMemberId: member.id,
      // Removed seats are included: the ledger and the activity feed still
      // reference them, so the client needs a name for every id it can meet.
      members: household.members.map((seat) => ({
        id: seat.id,
        displayName: seat.displayName,
        isYou: seat.id === member.id,
        status: seat.status,
        role: seat.role,
      })),
    };
  }),

  rename: ownerProcedure
    .input(z.object({ name: z.string().trim().min(1).max(80) }))
    .mutation(async (opts) => {
      const [household] = await db
        .update(Households)
        .set({ name: opts.input.name })
        .where(eq(Households.id, opts.ctx.householdId))
        .returning({ id: Households.id, name: Households.name });

      if (!household) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Household not found",
        });
      }

      return household;
    }),

  invite: ownerProcedure
    .input(
      z.object({
        email: z.email(),
        displayName: z.string().trim().min(1).max(80),
      }),
    )
    .mutation(async (opts) => {
      const { householdId, member } = opts.ctx;
      const { displayName } = opts.input;

      const email = opts.input.email.trim().toLowerCase();
      const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

      return db.transaction(async (tx) => {
        // `household_invites_open_email_key` makes a second open invite for the
        // same address a constraint violation rather than a no-op, so reusing
        // the live row has to be read-then-write. The lock is what keeps a
        // double-tap from 500ing in between the two halves.
        await lockHousehold(tx, householdId);

        // The partial unique index only covers *open* invites, so once one has
        // been redeemed nothing stops a second invite for the same address —
        // which would mint a seat `acceptInvite` then refuses to fill, leaving
        // a permanent phantom "Invited" row in the members list.
        const [claimed] = await tx
          .select({ id: HouseholdMembers.id })
          .from(HouseholdMembers)
          .innerJoin(users, eq(users.id, HouseholdMembers.userId))
          .where(
            and(
              eq(HouseholdMembers.householdId, householdId),
              eq(HouseholdMembers.status, "active"),
              sql`lower(${users.email}) = ${email}`,
            ),
          )
          .limit(1);

        if (claimed) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "They are already in this household",
          });
        }

        const [open] = await tx
          .select({
            id: HouseholdInvites.id,
            memberId: HouseholdInvites.memberId,
            code: HouseholdInvites.code,
          })
          .from(HouseholdInvites)
          .where(
            and(
              eq(HouseholdInvites.householdId, householdId),
              eq(HouseholdInvites.email, email),
              isNull(HouseholdInvites.redeemedAt),
              isNull(HouseholdInvites.revokedAt),
            ),
          )
          .limit(1);

        if (open) {
          // Re-inviting extends the live invite rather than minting a second
          // seat — the first one may already be carrying splits.
          await tx
            .update(HouseholdInvites)
            .set({ expiresAt })
            .where(
              and(
                eq(HouseholdInvites.id, open.id),
                eq(HouseholdInvites.householdId, householdId),
              ),
            );

          // Fixing a typo in the name is the other reason to re-invite. Guarded
          // on `invited` so this path can never rename a claimed seat.
          await tx
            .update(HouseholdMembers)
            .set({ displayName })
            .where(
              and(
                eq(HouseholdMembers.id, open.memberId),
                eq(HouseholdMembers.householdId, householdId),
                eq(HouseholdMembers.status, "invited"),
              ),
            );

          return {
            inviteId: open.id,
            memberId: open.memberId,
            code: open.code,
            expiresAt: expiresAt.toISOString(),
          };
        }

        // The seat is created up front and exists whether or not the invite is
        // ever accepted: splitting tonight's dinner with a roommate cannot wait
        // on them installing the app.
        const [seat] = await tx
          .insert(HouseholdMembers)
          .values({
            householdId,
            displayName,
            role: "member",
            status: "invited",
          })
          .returning({ id: HouseholdMembers.id });

        if (!seat) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create the member seat",
          });
        }

        const [invite] = await tx
          .insert(HouseholdInvites)
          .values({
            householdId,
            memberId: seat.id,
            email,
            code: inviteCode(),
            invitedByMemberId: member.id,
            expiresAt,
          })
          .returning({
            id: HouseholdInvites.id,
            code: HouseholdInvites.code,
            expiresAt: HouseholdInvites.expiresAt,
          });

        if (!invite) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create the invite",
          });
        }

        return {
          inviteId: invite.id,
          memberId: seat.id,
          code: invite.code,
          expiresAt: invite.expiresAt.toISOString(),
        };
      });
    }),

  invites: router({
    list: householdProcedure.query(async (opts) => {
      const rows = await db
        .select({
          id: HouseholdInvites.id,
          displayName: HouseholdMembers.displayName,
          email: HouseholdInvites.email,
          code: HouseholdInvites.code,
          expiresAt: HouseholdInvites.expiresAt,
          revokedAt: HouseholdInvites.revokedAt,
        })
        .from(HouseholdInvites)
        .innerJoin(
          HouseholdMembers,
          eq(HouseholdMembers.id, HouseholdInvites.memberId),
        )
        .where(
          and(
            eq(HouseholdInvites.householdId, opts.ctx.householdId),
            isNull(HouseholdInvites.redeemedAt),
            isNull(HouseholdInvites.revokedAt),
          ),
        )
        .orderBy(asc(HouseholdInvites.createdAt));

      // Expired invites stay in the list so the client can offer to re-send one
      // instead of silently losing it.
      return rows.map((row) => ({
        ...row,
        expiresAt: row.expiresAt.toISOString(),
        revokedAt: toIso(row.revokedAt),
      }));
    }),

    revoke: ownerProcedure
      .input(z.object({ inviteId: z.uuid() }))
      .mutation(async (opts) => {
        const [revoked] = await db
          .update(HouseholdInvites)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(HouseholdInvites.id, opts.input.inviteId),
              eq(HouseholdInvites.householdId, opts.ctx.householdId),
              isNull(HouseholdInvites.redeemedAt),
              isNull(HouseholdInvites.revokedAt),
            ),
          )
          .returning({ id: HouseholdInvites.id });

        if (!revoked) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Invite not found",
          });
        }

        // The seat deliberately survives: you can still split with someone whose
        // invite you took back, and `removeMember` is the way to retire them.
        return { inviteId: revoked.id };
      }),
  }),

  /**
   * Deliberately NOT a `householdProcedure`. Resolving a household here would
   * bootstrap one for the caller on the way in, and they would then be joining
   * from inside a competing household they never asked for.
   */
  acceptInvite: protectedProcedure
    .input(z.object({ code: z.string() }))
    .mutation(async (opts) => {
      const { user } = opts.ctx;

      // The code travels through a share sheet, so it cannot be the guard: a
      // forwarded screenshot must not hand a stranger every transaction in the
      // household. The real check is the address on the invite matching a
      // *verified* session, which is why an unverified one is refused outright
      // rather than being allowed to prove ownership of an address it never
      // demonstrated.
      if (!user.emailVerified) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Verify your email address before joining a household",
        });
      }

      const code = opts.input.code.trim().toUpperCase();

      const invite = await db.query.HouseholdInvites.findFirst({
        where: { code },
        columns: {
          id: true,
          householdId: true,
          memberId: true,
          email: true,
          expiresAt: true,
          revokedAt: true,
          redeemedAt: true,
          redeemedByUserId: true,
        },
      });

      // Lowercased on both sides rather than trusting the write path: a row that
      // predates that rule, or one seeded by hand, would otherwise refuse its
      // own addressee forever.
      if (
        !invite ||
        invite.email.trim().toLowerCase() !== user.email.trim().toLowerCase()
      ) {
        // One error for both cases. Whoever is holding a forwarded code learns
        // nothing from being told the code was real.
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That invite is not valid for this account",
        });
      }

      // A double-tap on Join, or a TanStack retry over a dropped response.
      if (invite.redeemedAt && invite.redeemedByUserId === user.id) {
        return {
          householdId: invite.householdId,
          memberId: invite.memberId,
        };
      }

      if (invite.redeemedAt || invite.revokedAt) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This invite has already been used",
        });
      }

      if (invite.expiresAt.getTime() <= Date.now()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This invite has expired — ask for a new one",
        });
      }

      const current = await db.query.HouseholdMembers.findFirst({
        where: { userId: user.id, status: "active" },
        orderBy: { createdAt: "asc" },
        columns: { id: true, householdId: true },
      });

      if (current?.householdId === invite.householdId) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You are already a member of this household",
        });
      }

      if (
        current &&
        (await householdHasData(current.householdId, current.id))
      ) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "Your current household still has bank connections, transactions or other members. Leave it before joining another one.",
        });
      }

      return db.transaction(async (tx) => {
        // The whole of single-use lives in this one statement's WHERE. The
        // checks above exist to produce a decent error message; they do not
        // decide anything, because two devices tapping Join at once would both
        // pass them and only one can win here.
        const [redeemed] = await tx
          .update(HouseholdInvites)
          .set({ redeemedAt: new Date(), redeemedByUserId: user.id })
          .where(
            and(
              eq(HouseholdInvites.id, invite.id),
              isNull(HouseholdInvites.redeemedAt),
              isNull(HouseholdInvites.revokedAt),
              gt(HouseholdInvites.expiresAt, sql`now()`),
            ),
          )
          .returning({
            householdId: HouseholdInvites.householdId,
            memberId: HouseholdInvites.memberId,
          });

        if (!redeemed) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This invite is no longer valid",
          });
        }

        const [seat] = await tx
          .update(HouseholdMembers)
          .set({ userId: user.id, status: "active", joinedAt: new Date() })
          .where(
            and(
              eq(HouseholdMembers.id, redeemed.memberId),
              eq(HouseholdMembers.householdId, redeemed.householdId),
              // Fills the seat the invite already created — never a second one,
              // or every split made against the first would point at a stranger.
              // `invited` also refuses a seat retired while the code was in
              // flight, which would otherwise resurrect a removed member.
              eq(HouseholdMembers.status, "invited"),
            ),
          )
          .returning({ id: HouseholdMembers.id });

        if (!seat) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "That seat is no longer available",
          });
        }

        if (current) {
          // The empty bootstrap household they arrived with. Retired, never
          // deleted, and retiring it is not optional: `resolveMember` picks the
          // oldest *active* seat, so leaving this one active would keep routing
          // every later request to the household they just left.
          await tx
            .update(HouseholdMembers)
            .set({ status: "removed", removedAt: new Date() })
            .where(
              and(
                eq(HouseholdMembers.id, current.id),
                eq(HouseholdMembers.userId, user.id),
              ),
            );
        }

        return { householdId: redeemed.householdId, memberId: seat.id };
      });
    }),

  removeMember: ownerProcedure
    .input(
      z.object({
        memberId: z.uuid(),
        writeOffBalance: z.boolean().optional(),
      }),
    )
    .mutation(async (opts) => {
      const { householdId, member } = opts.ctx;
      const { memberId, writeOffBalance } = opts.input;

      if (memberId === member.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot remove yourself",
        });
      }

      return db.transaction(async (tx) => {
        // Before the balances are read, not after: the write-off is
        // read-then-append against an append-only table, and a share posted
        // between the two would be zeroed out without ever being counted.
        await lockHousehold(tx, householdId);

        const [target] = await tx
          .select({
            id: HouseholdMembers.id,
            displayName: HouseholdMembers.displayName,
            role: HouseholdMembers.role,
            status: HouseholdMembers.status,
          })
          .from(HouseholdMembers)
          .where(
            and(
              eq(HouseholdMembers.id, memberId),
              eq(HouseholdMembers.householdId, householdId),
            ),
          )
          .limit(1);

        if (!target) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Member not found",
          });
        }

        if (target.status === "removed") {
          return { memberId, writtenOff: null };
        }

        if (target.role === "owner") {
          const remainingOwners = await tx
            .select({ id: HouseholdMembers.id })
            .from(HouseholdMembers)
            .where(
              and(
                eq(HouseholdMembers.householdId, householdId),
                eq(HouseholdMembers.role, "owner"),
                eq(HouseholdMembers.status, "active"),
                ne(HouseholdMembers.id, memberId),
              ),
            )
            .limit(1);

          if (remainingOwners.length === 0) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: "A household must keep at least one owner",
            });
          }
        }

        const outstanding = await tx.execute<{
          other_member_id: string;
          iso_currency_code: string;
          cents: string;
        }>(sql`
          select
            case when debtor_member_id = ${memberId}
                 then creditor_member_id else debtor_member_id end
              as other_member_id,
            iso_currency_code,
            sum(case when debtor_member_id = ${memberId}
                     then amount_cents else -amount_cents end)::text
              as cents
          from ledger_entries
          where household_id = ${householdId}
            and (debtor_member_id = ${memberId} or creditor_member_id = ${memberId})
          group by 1, 2
          having sum(case when debtor_member_id = ${memberId}
                          then amount_cents else -amount_cents end) <> 0
        `);

        // `sum()` arrives from node-postgres as a string, never a number.
        // Signed from the leaving member's side: positive means they owe.
        const pairs = outstanding.rows.map((row) => ({
          otherMemberId: row.other_member_id,
          currency: row.iso_currency_code,
          cents: Number(row.cents),
        }));

        if (pairs.length > 0 && writeOffBalance !== true) {
          const names = new Map(
            (
              await tx
                .select({
                  id: HouseholdMembers.id,
                  displayName: HouseholdMembers.displayName,
                })
                .from(HouseholdMembers)
                .where(eq(HouseholdMembers.householdId, householdId))
            ).map((seat) => [seat.id, seat.displayName]),
          );

          const summary = pairs
            .map((pair) => {
              const other = names.get(pair.otherMemberId) ?? "another member";
              const amount = `${fromCents(Math.abs(pair.cents))} ${pair.currency}`;

              return pair.cents > 0
                ? `${target.displayName} still owes ${other} ${amount}`
                : `${other} still owes ${target.displayName} ${amount}`;
            })
            .join("; ");

          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `${summary}. Write the balance off to remove them anyway.`,
          });
        }

        if (pairs.length > 0) {
          const externalRef = `adjustment:${memberId}:${randomUUID()}`;
          const effectiveDate = today();

          await tx.insert(LedgerEntries).values(
            pairs.map((pair) => ({
              householdId,
              // Same direction as the balance it cancels, opposite sign — a
              // ledger row is never updated or deleted, so zeroing a pair means
              // appending its negation.
              debtorMemberId: pair.cents > 0 ? memberId : pair.otherMemberId,
              creditorMemberId: pair.cents > 0 ? pair.otherMemberId : memberId,
              amountCents: -Math.abs(pair.cents),
              isoCurrencyCode: pair.currency,
              kind: "adjustment" as const,
              externalRef,
              memo: `Balance written off when ${target.displayName} was removed`,
              effectiveDate,
              createdByMemberId: member.id,
            })),
          );
        }

        // An outstanding code for this seat would set it straight back to
        // `active` and undo the removal.
        await tx
          .update(HouseholdInvites)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(HouseholdInvites.householdId, householdId),
              eq(HouseholdInvites.memberId, memberId),
              isNull(HouseholdInvites.redeemedAt),
              isNull(HouseholdInvites.revokedAt),
            ),
          );

        await tx
          .update(HouseholdMembers)
          .set({ status: "removed", removedAt: new Date() })
          .where(
            and(
              eq(HouseholdMembers.id, memberId),
              eq(HouseholdMembers.householdId, householdId),
            ),
          );

        // Magnitudes, summed per currency: two pairs can point in opposite
        // directions, so a signed total would report a write-off of nothing.
        const byCurrency = new Map<string, number>();

        for (const pair of pairs) {
          byCurrency.set(
            pair.currency,
            (byCurrency.get(pair.currency) ?? 0) + Math.abs(pair.cents),
          );
        }

        return {
          memberId,
          writtenOff:
            pairs.length === 0
              ? null
              : [...byCurrency].map(([currency, cents]) => ({
                  cents,
                  currency,
                })),
        };
      });
    }),

  setAccountOwner: ownerProcedure
    .input(z.object({ bankAccountId: z.uuid(), memberId: z.uuid() }))
    .mutation(async (opts) => {
      const { householdId } = opts.ctx;
      const { bankAccountId, memberId } = opts.input;

      // `bank_accounts_owner_fk` is composite, so the database already refuses
      // an owner from another household. This lookup is here for the error
      // message, and to refuse a removed seat, which the FK would happily allow.
      const [owner] = await db
        .select({ id: HouseholdMembers.id })
        .from(HouseholdMembers)
        .where(
          and(
            eq(HouseholdMembers.id, memberId),
            eq(HouseholdMembers.householdId, householdId),
            isNull(HouseholdMembers.removedAt),
          ),
        )
        .limit(1);

      if (!owner) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
      }

      // ── PROSPECTIVE ONLY ──────────────────────────────────────────────────
      // This changes who the *next* transaction on this account is owed to and
      // nothing else. Existing transactions keep the `creditor_member_id`
      // frozen onto them at insert and NOT ONE ledger entry moves.
      //
      // The instinct is to re-post history so the balances "look right". Don't:
      // correcting a mislabelled account would then silently reassign months of
      // real, already-settled debt to somebody who never paid for any of it, and
      // there is no undo for a balance nobody can reproduce.
      const [updated] = await db
        .update(BankAccounts)
        .set({ ownerMemberId: memberId })
        .where(
          and(
            eq(BankAccounts.id, bankAccountId),
            eq(BankAccounts.householdId, householdId),
          ),
        )
        .returning({
          id: BankAccounts.id,
          ownerMemberId: BankAccounts.ownerMemberId,
        });

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Account not found",
        });
      }

      return {
        bankAccountId: updated.id,
        ownerMemberId: updated.ownerMemberId,
      };
    }),

  accounts: router({
    update: householdProcedure
      .input(
        z.object({
          bankAccountId: z.uuid(),
          isPrivate: z.boolean().optional(),
          defaultSplit: z.enum(["owner", "equal"]).optional(),
          defaultSplitFrom: z.iso.date().nullable().optional(),
          excluded: z.boolean().optional(),
        }),
      )
      .mutation(async (opts) => {
        const { householdId, member } = opts.ctx;
        const { bankAccountId, isPrivate, defaultSplit, excluded } = opts.input;
        const { defaultSplitFrom } = opts.input;

        const set: PgUpdateSetSource<typeof BankAccounts> = {};

        if (isPrivate !== undefined) set.isPrivate = isPrivate;
        if (excluded !== undefined)
          set.excludedAt = excluded ? new Date() : null;
        if (defaultSplitFrom !== undefined)
          set.defaultSplitFrom = defaultSplitFrom;

        if (defaultSplit !== undefined) {
          set.defaultSplit = defaultSplit;

          if (defaultSplit === "equal") {
            // Today, never null. `resolveDefaultSplit` reads a null
            // `defaultSplitFrom` as "applies to every transaction ever", so
            // flipping the joint Amex to "split equally" without a floor would
            // invent two years of retroactive debt on the very next sync.
            set.defaultSplitFrom = defaultSplitFrom ?? today();
          }
        } else if (defaultSplitFrom === null) {
          // The same trap from the other side. Clearing the floor on an account
          // that is *already* `equal` invents exactly the same retroactive debt,
          // and this call carries no `defaultSplit` to test. Decided inside the
          // statement so it reads the account's real split without a second
          // round trip that could be stale by the time the write lands.
          set.defaultSplitFrom = sql`case when ${BankAccounts.defaultSplit} = 'equal' then ${today()}::date else null end`;
        }

        if (Object.keys(set).length === 0) return { bankAccountId };

        // Every other field here is household configuration, but privacy is a
        // disclosure: turning somebody else's private account back to visible
        // publishes every transaction on it. ANDed into the UPDATE's own WHERE
        // rather than checked by a prior SELECT, so the permission and the write
        // are one statement.
        const privacyScope =
          isPrivate === undefined || member.role === "owner"
            ? undefined
            : eq(BankAccounts.ownerMemberId, member.id);

        return db.transaction(async (tx) => {
          const [updated] = await tx
            .update(BankAccounts)
            .set(set)
            .where(
              and(
                eq(BankAccounts.id, bankAccountId),
                eq(BankAccounts.householdId, householdId),
                privacyScope,
              ),
            )
            .returning({ id: BankAccounts.id });

          if (!updated) {
            throw new TRPCError({
              code: privacyScope ? "FORBIDDEN" : "NOT_FOUND",
              message: privacyScope
                ? "Only the account's owner can change who sees it"
                : "Account not found",
            });
          }

          // `transactions.is_private` is a copy, kept so the list's privacy
          // filter needs no join — and a copy only the sync path refreshes, and
          // only for rows whose money moved. Without this, marking an account
          // private would leave every transaction already in it visible to the
          // whole household forever.
          if (isPrivate !== undefined) {
            await tx
              .update(Transactions)
              .set({ isPrivate })
              .where(
                and(
                  eq(Transactions.bankAccountId, bankAccountId),
                  eq(Transactions.householdId, householdId),
                ),
              );
          }

          return { bankAccountId: updated.id };
        });
      }),
  }),
});
