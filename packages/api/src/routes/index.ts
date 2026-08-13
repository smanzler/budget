import { router } from "../lib/trpc";
import { filesRouter } from "./files";
import { notificationsRouter } from "./notifications";
import { plaidRouter } from "./plaid";
import { transactionsRouter } from "./transactions";

export const appRouter = router({
  files: filesRouter,
  notifications: notificationsRouter,
  plaid: plaidRouter,
  transactions: transactionsRouter,
});

export type AppRouter = typeof appRouter;
