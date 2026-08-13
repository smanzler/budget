import { useTRPC } from "@/lib/trpc";
import { useQuery } from "@tanstack/react-query";

const SYNCING_POLL_MS = 3_000;

/**
 * Connected institutions with their accounts nested.
 *
 * Polls while any item is still on its first sync so the "fetching your
 * transactions" state resolves on its own — no effects, no manual timers. The
 * server flipping `syncing` → `active` is what stops it.
 */
export const usePlaidItems = () => {
  const trpc = useTRPC();

  const query = useQuery(
    trpc.plaid.items.list.queryOptions(undefined, {
      refetchInterval: ({ state }) =>
        state.data?.some((item) => item.status === "syncing")
          ? SYNCING_POLL_MS
          : false,
    }),
  );

  const items = query.data ?? [];

  return {
    ...query,
    items,
    hasItems: items.length > 0,
    isSyncing: items.some((item) => item.status === "syncing"),
    needsReconnect: items.some((item) => item.status === "login_required"),
  };
};
