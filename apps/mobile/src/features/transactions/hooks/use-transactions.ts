import { useTRPC } from "@/lib/trpc";
import { useInfiniteQuery } from "@tanstack/react-query";
import { groupByDay } from "../lib/group";

const PAGE_SIZE = 30;

export const useTransactions = () => {
  const trpc = useTRPC();

  const query = useInfiniteQuery(
    trpc.transactions.list.infiniteQueryOptions(
      // No `cursor` here — tRPC injects it per page.
      { limit: PAGE_SIZE },
      { getNextPageParam: (lastPage) => lastPage.nextCursor },
    ),
  );

  const transactions = query.data?.pages.flatMap((page) => page.items) ?? [];
  const sections = groupByDay(transactions);

  const loadMore = () => {
    // onEndReached fires spuriously, including on an empty list.
    if (query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  };

  return { query, sections, loadMore };
};
