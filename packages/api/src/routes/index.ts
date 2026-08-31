import { router } from "../lib/trpc";
import { expensesRouter } from "./expenses";
import { filesRouter } from "./files";
import { groupsRouter } from "./groups";
import { notificationsRouter } from "./notifications";

export const appRouter = router({
  expenses: expensesRouter,
  files: filesRouter,
  groups: groupsRouter,
  notifications: notificationsRouter,
});

export type AppRouter = typeof appRouter;
