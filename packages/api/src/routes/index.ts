import { router } from "../lib/trpc";
import { expensesRouter } from "./expenses";
import { groupsRouter } from "./groups";
import { notificationsRouter } from "./notifications";
import { userRouter } from "./user";

export const appRouter = router({
  expenses: expensesRouter,
  groups: groupsRouter,
  notifications: notificationsRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;
