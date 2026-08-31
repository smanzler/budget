import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { isSplitError, splitEqually } from "@budget/shared";
import db from "../../db/index";
import { ExpenseSplits, Expenses, GroupMembers, users } from "../../db/schema";
import { requireMembership } from "../../lib/groups";
import { protectedProcedure, router } from "../../lib/trpc";

/** Keeps a total inside the `integer` column. */
const MAX_TOTAL_MINOR = 2_000_000_000;

const EXPENSE_PAGE_SIZE = 100;

async function activeMemberIds(groupId: string) {
  const rows = await db
    .select({ userId: GroupMembers.userId })
    .from(GroupMembers)
    .where(and(eq(GroupMembers.groupId, groupId), isNull(GroupMembers.leftAt)));

  return new Set(rows.map((row) => row.userId));
}

const sqlNumber = (value: string) => sql<number>`${value}`.mapWith(Number);

export const expensesRouter = router({
  list: protectedProcedure
    .input(z.object({ groupId: z.uuid() }))
    .query(async (opts) => {
      const { user } = opts.ctx;
      const { groupId } = opts.input;

      await requireMembership(groupId, user.id);

      const expenses = await db
        .select({
          id: Expenses.id,
          description: Expenses.description,
          totalMinor: Expenses.totalMinor,
          spentAt: Expenses.spentAt,
          paidById: users.id,
          paidByName: users.name,
          participantCount: sqlNumber(
            `(select count(*) from ${ExpenseSplits} where ${ExpenseSplits.expenseId} = ${Expenses.id})`,
          ),
          myShareMinor: sqlNumber(
            `(select coalesce(sum(${ExpenseSplits.amountMinor}), 0) from ${ExpenseSplits} where ${ExpenseSplits.expenseId} = ${Expenses.id} and ${ExpenseSplits.userId} = ${user.id})`,
          ),
        })
        .from(Expenses)
        .innerJoin(users, eq(users.id, Expenses.paidByUserId))
        .where(eq(Expenses.groupId, groupId))
        .orderBy(desc(Expenses.spentAt), desc(Expenses.createdAt))
        .limit(EXPENSE_PAGE_SIZE);

      return expenses.map((expense) => ({
        id: expense.id,
        description: expense.description,
        totalMinor: expense.totalMinor,
        // tRPC has no transformer: send a string.
        spentAt: expense.spentAt.toISOString(),
        paidBy: { id: expense.paidById, name: expense.paidByName },
        isPaidByMe: expense.paidById === user.id,
        participantCount: expense.participantCount,
        myShareMinor: expense.myShareMinor,
      }));
    }),

  create: protectedProcedure
    .input(
      z.object({
        groupId: z.uuid(),
        description: z.string().trim().min(1).max(100),
        totalMinor: z.int().positive().max(MAX_TOTAL_MINOR),
        paidByUserId: z.uuid(),
        participantIds: z.array(z.uuid()).min(1),
      }),
    )
    .mutation(async (opts) => {
      const { user } = opts.ctx;
      const { groupId, description, totalMinor, paidByUserId, participantIds } =
        opts.input;

      await requireMembership(groupId, user.id);

      const memberIds = await activeMemberIds(groupId);

      if (!memberIds.has(paidByUserId)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Whoever paid has to be in the group",
        });
      }

      const outsider = participantIds.find((id) => !memberIds.has(id));

      if (outsider) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Everyone splitting an expense has to be in the group",
        });
      }

      let shares;

      try {
        shares = splitEqually(totalMinor, participantIds, paidByUserId);
      } catch (caught) {
        if (isSplitError(caught)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: caught.message,
            cause: caught,
          });
        }

        throw caught;
      }

      return db.transaction(async (tx) => {
        const [expense] = await tx
          .insert(Expenses)
          .values({
            groupId,
            description,
            totalMinor,
            paidByUserId,
            createdBy: user.id,
          })
          .returning({ id: Expenses.id });

        if (!expense) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Could not record the expense",
          });
        }

        await tx.insert(ExpenseSplits).values(
          shares.map((share) => ({
            expenseId: expense.id,
            userId: share.userId,
            amountMinor: share.amountMinor,
          })),
        );

        return { id: expense.id };
      });
    }),
});
