import type { RouterOutputs } from "@/lib/trpc";
import { useTRPC } from "@/lib/trpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type Member = RouterOutputs["household"]["get"]["members"][number];

/**
 * The household, shaped for the screens.
 *
 * `household.get` includes removed seats so the ledger and the activity feed
 * can name every id they reference — no members list should ever show one.
 */
export const useHousehold = () => {
  const trpc = useTRPC();
  const query = useQuery(trpc.household.get.queryOptions());

  const members = (query.data?.members ?? []).filter(
    (member) => member.status !== "removed",
  );
  const you = members.find((member) => member.isYou);

  return {
    ...query,
    members,
    you,
    isOwner: you?.role === "owner",
    /** Every household surface hangs off this: alone, none of them render. */
    isShared: members.length > 1,
  };
};

export const useRemoveMember = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.household.removeMember.mutationOptions({
      onSuccess: async () => {
        // Balances too: writing a leaver's balance off appends ledger entries.
        await Promise.all([
          queryClient.invalidateQueries(trpc.household.pathFilter()),
          queryClient.invalidateQueries(trpc.balances.pathFilter()),
          queryClient.invalidateQueries(trpc.transactions.list.pathFilter()),
        ]);
      },
    }),
  );
};

/** Who the *next* transaction on an account is owed to. History never moves. */
export const useSetAccountOwner = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.household.setAccountOwner.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.plaid.pathFilter());
      },
    }),
  );
};

export const useUpdateAccount = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.household.accounts.update.mutationOptions({
      onSuccess: async () => {
        // Privacy rewrites `transactions.is_private` for every row already in
        // the account, so the list has to be refetched, not just the settings.
        await Promise.all([
          queryClient.invalidateQueries(trpc.plaid.pathFilter()),
          queryClient.invalidateQueries(trpc.transactions.list.pathFilter()),
        ]);
      },
    }),
  );
};
