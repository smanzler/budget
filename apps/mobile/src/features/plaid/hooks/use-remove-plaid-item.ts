import { useTRPC } from "@/lib/trpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/** Revokes the connection at Plaid and deletes its accounts and transactions. */
export const useRemovePlaidItem = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.plaid.items.remove.mutationOptions({
      onSuccess: async () => {
        // pathFilter matches both plain and infinite queries.
        await Promise.all([
          queryClient.invalidateQueries(trpc.plaid.pathFilter()),
          queryClient.invalidateQueries(trpc.transactions.list.pathFilter()),
        ]);
      },
    }),
  );
};
