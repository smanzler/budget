import { createLinks, TRPCProvider } from "@/lib/trpc";
import { AppRouter } from "@budget/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient } from "@trpc/client";
import { useState } from "react";

export function QueryProvider(props: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Without a staleTime every mount refetches *every* loaded page of
            // an infinite query, which for the transaction list is brutal.
            staleTime: 30_000,
            gcTime: 300_000,
            retry: 2,
          },
        },
      }),
  );
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({ links: createLinks() }),
  );

  return (
    <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {props.children}
      </QueryClientProvider>
    </TRPCProvider>
  );
}
