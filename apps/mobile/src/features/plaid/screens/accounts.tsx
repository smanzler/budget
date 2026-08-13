import { RefetchScroll } from "@/components/refetch-scroll";
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
import { authClient } from "@/lib/auth-client";
import { TriangleAlert } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { AccountsEmpty } from "../components/accounts-empty";
import { ConnectBankButton } from "../components/connect-bank-button";
import { DisconnectItemDialog } from "../components/disconnect-item-dialog";
import { InstitutionSection } from "../components/institution-section";
import { usePlaidItems } from "../hooks/use-plaid-items";
import { useSyncNow } from "../hooks/use-sync-now";
import { formatLastSynced, type PlaidItem } from "../lib/format";

export function Accounts() {
  const items = usePlaidItems();
  const syncNow = useSyncNow();

  const [pendingDisconnect, setPendingDisconnect] = useState<PlaidItem | null>(
    null,
  );

  const lastSyncedAt = items.data
    ?.map((item) => item.lastSyncedAt)
    .filter((value): value is string => value !== null)
    .sort()
    .at(-1);

  if (items.isError) {
    return (
      <RefetchScroll
        refetch={items.refetch}
        isEmpty
        empty={
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Icon as={TriangleAlert} className="text-muted-foreground" />
              </EmptyMedia>
              <EmptyTitle>Couldn&apos;t load your accounts</EmptyTitle>
              <EmptyDescription>
                Check your connection and try again.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" onPress={() => void items.refetch()}>
                <Text>Try again</Text>
              </Button>
            </EmptyContent>
          </Empty>
        }
      />
    );
  }

  return (
    <>
      <RefetchScroll
        refetch={items.refetch}
        isLoading={items.isPending}
        loading={
          <View className="flex-1 items-center justify-center">
            <Spinner className="text-muted-foreground size-6" />
          </View>
        }
        isEmpty={items.data?.length === 0}
        empty={<AccountsEmpty />}
      >
        {items.data?.map((item) => (
          <InstitutionSection
            key={item.id}
            item={item}
            onDisconnect={setPendingDisconnect}
          />
        ))}

        <View className="gap-2 pt-2">
          <ConnectBankButton
            label="Connect another account"
            variant="outline"
          />

          <Button
            variant="ghost"
            disabled={syncNow.isPending}
            onPress={() => void syncNow.mutateAsync({}).catch(console.error)}
          >
            {syncNow.isPending ? (
              <Spinner className="text-muted-foreground" />
            ) : null}
            <Text>Sync now</Text>
          </Button>

          <Text className="text-muted-foreground text-center text-xs">
            {formatLastSynced(lastSyncedAt ?? null)}
          </Text>
        </View>

        <View className="pt-6">
          <Button variant="outline" onPress={() => void authClient.signOut()}>
            <Text>Sign out</Text>
          </Button>
        </View>
      </RefetchScroll>

      {/* Rendered outside RefetchScroll: on iOS DialogOverlay wraps itself in a
          FullWindowOverlay, and anything Plaid presents over it is unreachable.
          Nothing here opens Link, but keep them separate. */}
      <DisconnectItemDialog
        itemId={pendingDisconnect?.id ?? null}
        institutionName={pendingDisconnect?.institutionName ?? null}
        open={pendingDisconnect !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDisconnect(null);
        }}
      />
    </>
  );
}
