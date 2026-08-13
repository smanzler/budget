import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { Landmark, Receipt, TriangleAlert } from "lucide-react-native";
import type { ReactNode } from "react";
import { View } from "react-native";

/**
 * "Nothing here" is really three different situations, and telling them apart
 * is the difference between a polished first run and an app that looks broken.
 */
export type TransactionListState =
  | "loading"
  | "error"
  /** No bank connected yet — this is the whole app's primary call to action. */
  | "no-items"
  /** Connected, first sync still running. Resolves on its own. */
  | "syncing"
  /** Connected and synced, genuinely nothing to show. */
  | "empty";

export function TransactionListEmpty({
  state,
  action,
  onRetry,
}: {
  state: TransactionListState;
  /** The connect CTA, injected so this file doesn't depend on Plaid. */
  action?: ReactNode;
  onRetry?: () => void;
}) {
  if (state === "loading") {
    return (
      <View className="flex-1 items-center justify-center">
        <Spinner className="text-muted-foreground size-6" />
      </View>
    );
  }

  if (state === "error") {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon as={TriangleAlert} className="text-muted-foreground" />
          </EmptyMedia>
          <EmptyTitle>Couldn&apos;t load transactions</EmptyTitle>
          <EmptyDescription>
            Check your connection and try again.
          </EmptyDescription>
        </EmptyHeader>
        {onRetry ? (
          <EmptyContent>
            <Button variant="outline" onPress={onRetry}>
              <Text>Try again</Text>
            </Button>
          </EmptyContent>
        ) : null}
      </Empty>
    );
  }

  if (state === "syncing") {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Spinner className="text-muted-foreground size-6" />
          </EmptyMedia>
          <EmptyTitle>Fetching your transactions</EmptyTitle>
          <EmptyDescription>
            This can take a minute the first time. The list fills in as they
            arrive.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (state === "no-items") {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon as={Landmark} className="text-muted-foreground" />
          </EmptyMedia>
          <EmptyTitle>Connect your bank</EmptyTitle>
          <EmptyDescription>
            Link a card to see every transaction in one place.
          </EmptyDescription>
        </EmptyHeader>
        {action ? <EmptyContent>{action}</EmptyContent> : null}
      </Empty>
    );
  }

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon as={Receipt} className="text-muted-foreground" />
        </EmptyMedia>
        <EmptyTitle>No transactions yet</EmptyTitle>
        <EmptyDescription>
          Pull down to check for new activity.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
