import { and, count, desc, eq, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { currencyCodeSchema } from "@budget/shared";
import db from "../../db/index";
import { GroupInvites, GroupMembers, Groups, users } from "../../db/schema";
import { groupNetBalances, userNetBalancesByGroup } from "../../lib/balances";
import { requireGroup, requireMembership } from "../../lib/groups";
import {
  isInviteUsable,
  isValidInviteCode,
  normalizeInviteCode,
} from "../../lib/invite-code";
import { protectedProcedure, router } from "../../lib/trpc";
import { groupInvitesRouter } from "./invites";

const groupNameSchema = z.string().trim().min(1).max(60);

export const groupsRouter = router({
  invites: groupInvitesRouter,

  /** The groups the caller is currently in, newest first. */
  list: protectedProcedure.query(async (opts) => {
    const { user } = opts.ctx;

    // The caller's own membership joined to every active membership of the same
    // group answers both "which groups" and "how many people in each".
    const myMembership = alias(GroupMembers, "my_membership");

    const [groups, net] = await Promise.all([
      db
        .select({
          id: Groups.id,
          name: Groups.name,
          currency: Groups.currency,
          memberCount: count(GroupMembers.id),
        })
        .from(myMembership)
        .innerJoin(Groups, eq(Groups.id, myMembership.groupId))
        .innerJoin(
          GroupMembers,
          and(eq(GroupMembers.groupId, Groups.id), isNull(GroupMembers.leftAt)),
        )
        .where(
          and(eq(myMembership.userId, user.id), isNull(myMembership.leftAt)),
        )
        .groupBy(Groups.id)
        .orderBy(desc(Groups.createdAt)),
      userNetBalancesByGroup(user.id),
    ]);

    return groups.map((group) => ({
      ...group,
      myNetMinor: net.get(group.id) ?? 0,
    }));
  }),

  /**
   * A single group with its current members. Members only.
   *
   * `netMinor` is positive for a member the group owes, negative for one who
   * owes the group.
   */
  get: protectedProcedure
    .input(z.object({ groupId: z.uuid() }))
    .query(async (opts) => {
      const { user } = opts.ctx;
      const { groupId } = opts.input;

      const group = await requireGroup(groupId, user.id);

      const [members, net] = await Promise.all([
        db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            image: users.image,
          })
          .from(GroupMembers)
          .innerJoin(users, eq(users.id, GroupMembers.userId))
          .where(
            and(eq(GroupMembers.groupId, groupId), isNull(GroupMembers.leftAt)),
          )
          .orderBy(GroupMembers.joinedAt),
        groupNetBalances(groupId),
      ]);

      return {
        id: group.id,
        name: group.name,
        currency: group.currency,
        members: members.map((member) => ({
          ...member,
          netMinor: net.get(member.id) ?? 0,
        })),
        myNetMinor: net.get(user.id) ?? 0,
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: groupNameSchema,
        currency: currencyCodeSchema,
      }),
    )
    .mutation(async (opts) => {
      const { user } = opts.ctx;
      const { name, currency } = opts.input;

      // The creator is a member from the start, so the two writes go together.
      return db.transaction(async (tx) => {
        const [group] = await tx
          .insert(Groups)
          .values({ name, currency, createdBy: user.id })
          .returning();

        if (!group) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Could not create the group",
          });
        }

        await tx
          .insert(GroupMembers)
          .values({ groupId: group.id, userId: user.id });

        return { id: group.id, name: group.name, currency: group.currency };
      });
    }),

  rename: protectedProcedure
    .input(z.object({ groupId: z.uuid(), name: groupNameSchema }))
    .mutation(async (opts) => {
      const { user } = opts.ctx;
      const { groupId, name } = opts.input;

      await requireMembership(groupId, user.id);

      const [group] = await db
        .update(Groups)
        .set({ name })
        .where(eq(Groups.id, groupId))
        .returning({
          id: Groups.id,
          name: Groups.name,
          currency: Groups.currency,
        });

      if (!group) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Group not found" });
      }

      return group;
    }),

  /**
   * Leaving is a soft exit: the membership row stays so the person still
   * resolves on past activity. It needs a settled balance, because a member who
   * is gone can no longer be paid or asked to pay.
   */
  leave: protectedProcedure
    .input(z.object({ groupId: z.uuid() }))
    .mutation(async (opts) => {
      const { user } = opts.ctx;
      const { groupId } = opts.input;

      await requireMembership(groupId, user.id);

      const net = await groupNetBalances(groupId);

      if ((net.get(user.id) ?? 0) !== 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Settle up with the group before you leave it",
        });
      }

      await db
        .update(GroupMembers)
        .set({ leftAt: new Date() })
        .where(
          and(
            eq(GroupMembers.groupId, groupId),
            eq(GroupMembers.userId, user.id),
            isNull(GroupMembers.leftAt),
          ),
        );

      return { groupId };
    }),

  /** Join with a shared code. Joining twice, or rejoining, is a no-op. */
  join: protectedProcedure
    .input(z.object({ code: z.string() }))
    .mutation(async (opts) => {
      const { user } = opts.ctx;
      const code = normalizeInviteCode(opts.input.code);

      if (!isValidInviteCode(code)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That invite code doesn't look right",
        });
      }

      const [invite] = await db
        .select()
        .from(GroupInvites)
        .where(eq(GroupInvites.code, code))
        .limit(1);

      if (!invite) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That invite code doesn't exist",
        });
      }

      if (!isInviteUsable(invite, new Date())) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That invite has expired",
        });
      }

      // Clearing `left_at` re-activates a previous membership and keeps the
      // original `joined_at`; for a current member it changes nothing.
      await db
        .insert(GroupMembers)
        .values({ groupId: invite.groupId, userId: user.id })
        .onConflictDoUpdate({
          target: [GroupMembers.groupId, GroupMembers.userId],
          set: { leftAt: null },
        });

      const [group] = await db
        .select({
          id: Groups.id,
          name: Groups.name,
          currency: Groups.currency,
        })
        .from(Groups)
        .where(eq(Groups.id, invite.groupId))
        .limit(1);

      if (!group) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Group not found" });
      }

      return group;
    }),
});
