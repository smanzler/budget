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
import { Receipt, TriangleAlert } from "lucide-react-native";
import type { ReactNode } from "react";
import { View } from "react-native";

export type TransactionListState = "loading" | "error" | "empty";

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

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon as={Receipt} className="text-muted-foreground" />
        </EmptyMedia>
        <EmptyTitle>No transactions yet</EmptyTitle>
        <EmptyDescription>
          Connect a bank to see your spending here, or pull down to refresh.
        </EmptyDescription>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}
