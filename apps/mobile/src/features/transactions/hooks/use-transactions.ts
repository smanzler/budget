import { useTRPC } from "@/lib/trpc";
import { useInfiniteQuery } from "@tanstack/react-query";
import { groupByDay } from "../lib/group";

const PAGE_SIZE = 30;
const SYNCING_POLL_MS = 3_000;

export const useTransactions = ({
  accountId,
  isSyncing = false,
}: {
  accountId?: string;
  /** Poll while a first sync is running so rows appear as they land. */
  isSyncing?: boolean;
} = {}) => {
  const trpc = useTRPC();

  const query = useInfiniteQuery(
    trpc.transactions.list.infiniteQueryOptions(
      // No `cursor` here — tRPC injects it per page.
      { limit: PAGE_SIZE, ...(accountId ? { accountId } : {}) },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        refetchInterval: isSyncing ? SYNCING_POLL_MS : false,
      },
    ),
  );

  // A pending transaction can change `date` when it posts, which moves it
  // between pages and can surface it twice. Duplicate keys break SectionList,
  // so dedupe before grouping.
  const seen = new Set<string>();
  const transactions = (query.data?.pages ?? [])
    .flatMap((page) => page.items)
    .filter((transaction) => {
      if (seen.has(transaction.id)) return false;
      seen.add(transaction.id);
      return true;
    });

  // Grouped after flattening, so a day split across two pages merges silently.
  const sections = groupByDay(transactions);

  const loadMore = () => {
    // `onEndReached` fires spuriously, including on an empty list.
    if (query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  };

  return { ...query, sections, transactions, loadMore };
};
