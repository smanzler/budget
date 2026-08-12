import db from "../../db/index";
import { Notifications } from "../../db/schema";
import { and, desc, eq } from "drizzle-orm";
import { protectedProcedure, router } from "../../lib/trpc";
import { z } from "zod";
import { pushTokensRouter } from "./push-tokens";

export const notificationsRouter = router({
  pushTokens: pushTokensRouter,

  list: protectedProcedure.query(async (opts) => {
    const { user } = opts.ctx;

    return db
      .select()
      .from(Notifications)
      .where(eq(Notifications.userId, user.id))
      .orderBy(desc(Notifications.createdAt))
      .limit(50);
  }),

  markRead: protectedProcedure
    .input(z.object({ notificationId: z.uuid() }))
    .mutation(async (opts) => {
      const { user } = opts.ctx;
      const { notificationId } = opts.input;

      await db
        .update(Notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(Notifications.id, notificationId),
            eq(Notifications.userId, user.id),
          ),
        );

      return { notificationId };
    }),
});
