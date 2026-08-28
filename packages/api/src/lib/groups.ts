import { and, eq, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import db from "../db/index";
import { GroupMembers, Groups } from "../db/schema";

/**
 * Everything a member may do — read a group, invite, add expenses later — hangs
 * off this check, so it lives outside the router for the other routers to reuse.
 *
 * Distinguishes "no such group" from "not your group" only to the extent that
 * both answer 404/403 without leaking whether a group id exists.
 */
export async function requireMembership(groupId: string, userId: string) {
  const [membership] = await db
    .select({
      groupId: GroupMembers.groupId,
      userId: GroupMembers.userId,
      joinedAt: GroupMembers.joinedAt,
    })
    .from(GroupMembers)
    .where(
      and(
        eq(GroupMembers.groupId, groupId),
        eq(GroupMembers.userId, userId),
        isNull(GroupMembers.leftAt),
      ),
    )
    .limit(1);

  if (!membership) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Group not found",
    });
  }

  return membership;
}

/** The group itself, once membership has been established. */
export async function requireGroup(groupId: string, userId: string) {
  await requireMembership(groupId, userId);

  const [group] = await db
    .select()
    .from(Groups)
    .where(eq(Groups.id, groupId))
    .limit(1);

  if (!group) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Group not found" });
  }

  return group;
}
