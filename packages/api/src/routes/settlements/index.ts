import { desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import db from "../../db/index";
import { LedgerEntries, Settlements, users } from "../../db/schema";
import { activeMemberIds, requireMembership } from "../../lib/groups";
import { MAX_AMOUNT_MINOR } from "../../lib/money";
import { protectedProcedure, router } from "../../lib/trpc";

const SETTLEMENT_PAGE_SIZE = 100;

export const settlementsRouter = router({
  /** The payments inside the group, newest first. Members only. */
  list: protectedProcedure
    .input(z.object({ groupId: z.uuid() }))
    .query(async (opts) => {
      const { user } = opts.ctx;
      const { groupId } = opts.input;

      await requireMembership(groupId, user.id);

      const payer = alias(users, "payer");
      const receiver = alias(users, "receiver");

      const settlements = await db
        .select({
          id: Settlements.id,
          amountMinor: Settlements.amountMinor,
          settledAt: Settlements.settledAt,
          fromId: payer.id,
          fromName: payer.name,
          toId: receiver.id,
          toName: receiver.name,
        })
        .from(Settlements)
        .innerJoin(payer, eq(payer.id, Settlements.fromUserId))
        .innerJoin(receiver, eq(receiver.id, Settlements.toUserId))
        .where(eq(Settlements.groupId, groupId))
        .orderBy(desc(Settlements.settledAt), desc(Settlements.createdAt))
        .limit(SETTLEMENT_PAGE_SIZE);

      return settlements.map((settlement) => ({
        id: settlement.id,
        amountMinor: settlement.amountMinor,
        // tRPC has no transformer: send a string.
        settledAt: settlement.settledAt.toISOString(),
        from: { id: settlement.fromId, name: settlement.fromName },
        to: { id: settlement.toId, name: settlement.toName },
      }));
    }),

  /**
   * Record that `fromUserId` paid `toUserId` outside the app. Any member can
   * record a payment, including one between two other members.
   */
  create: protectedProcedure
    .input(
      z.object({
        groupId: z.uuid(),
        fromUserId: z.uuid(),
        toUserId: z.uuid(),
        amountMinor: z.int().positive().max(MAX_AMOUNT_MINOR),
      }),
    )
    .mutation(async (opts) => {
      const { user } = opts.ctx;
      const { groupId, fromUserId, toUserId, amountMinor } = opts.input;

      await requireMembership(groupId, user.id);

      if (fromUserId === toUserId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A payment needs two different people",
        });
      }

      const memberIds = await activeMemberIds(groupId);

      if (!memberIds.has(fromUserId) || !memberIds.has(toUserId)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Both people in a payment have to be in the group",
        });
      }

      return db.transaction(async (tx) => {
        const [settlement] = await tx
          .insert(Settlements)
          .values({
            groupId,
            fromUserId,
            toUserId,
            amountMinor,
            createdBy: user.id,
          })
          .returning({ id: Settlements.id });

        if (!settlement) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Could not record the payment",
          });
        }

        // The payer put in the money and the receiver used it, so the rows of
        // the payment add up to zero.
        await tx.insert(LedgerEntries).values([
          {
            groupId,
            settlementId: settlement.id,
            userId: fromUserId,
            amountMinor,
          },
          {
            groupId,
            settlementId: settlement.id,
            userId: toUserId,
            amountMinor: -amountMinor,
          },
        ]);

        return { id: settlement.id };
      });
    }),
});
