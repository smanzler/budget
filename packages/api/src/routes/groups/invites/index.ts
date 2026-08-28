import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import db from "../../../db/index";
import { GroupInvites } from "../../../db/schema";
import { requireMembership } from "../../../lib/groups";
import { generateInviteCode, inviteExpiryFrom } from "../../../lib/invite-code";
import { protectedProcedure, router } from "../../../lib/trpc";

export const groupInvitesRouter = router({
  /**
   * The code to share for a group. Any member can ask for one, and an invite
   * that is still usable is handed back as-is so a group doesn't accumulate a
   * new live code every time someone opens the invite sheet.
   */
  create: protectedProcedure
    .input(z.object({ groupId: z.uuid() }))
    .mutation(async (opts) => {
      const { user } = opts.ctx;
      const { groupId } = opts.input;

      await requireMembership(groupId, user.id);

      const now = new Date();

      const [existing] = await db
        .select({
          code: GroupInvites.code,
          expiresAt: GroupInvites.expiresAt,
        })
        .from(GroupInvites)
        .where(
          and(
            eq(GroupInvites.groupId, groupId),
            isNull(GroupInvites.revokedAt),
            gt(GroupInvites.expiresAt, now),
          ),
        )
        .orderBy(desc(GroupInvites.expiresAt))
        .limit(1);

      if (existing) {
        return {
          code: existing.code,
          // No transformer is configured on tRPC yet, so dates cross the wire
          // as ISO strings — say so in the type instead of lying about it.
          expiresAt: existing.expiresAt.toISOString(),
        };
      }

      const [invite] = await db
        .insert(GroupInvites)
        .values({
          groupId,
          code: generateInviteCode(),
          createdBy: user.id,
          expiresAt: inviteExpiryFrom(now),
        })
        .returning({
          code: GroupInvites.code,
          expiresAt: GroupInvites.expiresAt,
        });

      if (!invite) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not create an invite",
        });
      }

      return { code: invite.code, expiresAt: invite.expiresAt.toISOString() };
    }),
});
