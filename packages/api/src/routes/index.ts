import { router } from "../lib/trpc";
import { filesRouter } from "./files";
import { notificationsRouter } from "./notifications";

export const appRouter = router({
  files: filesRouter,
  notifications: notificationsRouter,
});

export type AppRouter = typeof appRouter;
