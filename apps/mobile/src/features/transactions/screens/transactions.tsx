import RefetchControl from "@/components/refetch-control";
import { ConnectBankButton } from "@/features/plaid/components/connect-bank-button";
import { usePlaidItems } from "@/features/plaid/hooks/use-plaid-items";
import { useTRPC } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Platform, SectionList } from "react-native";
import { TransactionDayHeader } from "../components/transaction-day-header";
import {
  TransactionListEmpty,
  type TransactionListState,
} from "../components/transaction-list-empty";
import { TransactionListFooter } from "../components/transaction-list-footer";
import { TransactionRow } from "../components/transaction-row";
import { useTransactions } from "../hooks/use-transactions";

export function Transactions() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Reading both here is free: httpBatchLink collapses same-tick calls into
  // one request.
  const items = usePlaidItems();
  const transactions = useTransactions({ isSyncing: items.isSyncing });

  // Awaited server-side, so pull-to-refresh reflects real new data rather than
  // refetching the same rows.
  const syncNow = useMutation(trpc.plaid.syncNow.mutationOptions());

  const refetch = async () => {
    if (items.hasItems) {
      // A failed sync shouldn't block the refetch — show whatever we have.
      await syncNow.mutateAsync({}).catch((error: unknown) => {
        console.error(error);
      });
    }

    await Promise.all([
      items.refetch(),
      queryClient.invalidateQueries(trpc.transactions.list.pathFilter()),
    ]);
  };

  const state = listState({
    isLoading: transactions.isPending || items.isPending,
    isError: transactions.isError,
    hasItems: items.hasItems,
    isSyncing: items.isSyncing,
    isEmpty: transactions.sections.length === 0,
  });

  const isEmpty = state !== null;

  return (
    <SectionList
      sections={transactions.sections}
      keyExtractor={(item) => item.id}
      stickySectionHeadersEnabled
      refreshControl={<RefetchControl refetch={refetch} />}
      automaticallyAdjustsScrollIndicatorInsets
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName={cn(
        "m-4 gap-1",
        Platform.OS === "android" ? "pb-safe-offset-8" : "pb-4",
        // Only when empty, so `Empty`'s flex-1 has something to fill.
        isEmpty && "grow",
      )}
      renderSectionHeader={({ section }) => (
        <TransactionDayHeader section={section} />
      )}
      renderItem={({ item, index, section }) => (
        <TransactionRow
          transaction={item}
          isFirst={index === 0}
          isLast={index === section.data.length - 1}
        />
      )}
      ListEmptyComponent={
        state ? (
          <TransactionListEmpty
            state={state}
            onRetry={() => void transactions.refetch()}
            action={<ConnectBankButton />}
          />
        ) : null
      }
      ListFooterComponent={
        <TransactionListFooter
          isFetchingNextPage={transactions.isFetchingNextPage}
        />
      }
      onEndReached={transactions.loadMore}
      onEndReachedThreshold={0.5}
    />
  );
}

/** Null means "there are rows to show". */
const listState = ({
  isLoading,
  isError,
  hasItems,
  isSyncing,
  isEmpty,
}: {
  isLoading: boolean;
  isError: boolean;
  hasItems: boolean;
  isSyncing: boolean;
  isEmpty: boolean;
}): TransactionListState | null => {
  if (!isEmpty) return null;
  if (isLoading) return "loading";
  if (isError) return "error";
  if (!hasItems) return "no-items";
  if (isSyncing) return "syncing";
  return "empty";
};
