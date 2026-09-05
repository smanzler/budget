import { HeaderLink } from "@/components/header-link";
import { RefetchScroll } from "@/components/refetch-scroll";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { useTRPC } from "@/lib/trpc";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { Settings, TriangleAlert } from "lucide-react-native";
import { View } from "react-native";
import { ExpenseList } from "@/features/expenses/components/expense-list";
import { BalanceSummary } from "../components/balance-summary";

export function GroupDetail() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const {
    data: group,
    error,
    isLoading,
    refetch,
  } = useQuery(trpc.groups.get.queryOptions({ groupId }));

  // The expense list has its own query. Refresh it with the group.
  const refresh = () =>
    Promise.all([
      refetch(),
      queryClient.invalidateQueries({
        queryKey: trpc.expenses.list.queryKey({ groupId }),
      }),
    ]);

  return (
    <>
      <Stack.Screen
        options={{
          title: group?.name ?? "Group",
          headerRight: () => (
            <HeaderLink
              icon={Settings}
              label="Group settings"
              href={{
                pathname: "/groups/[groupId]/settings",
                params: { groupId },
              }}
            />
          ),
        }}
      />

      <RefetchScroll
        refetch={refresh}
        isLoading={isLoading}
        loading={
          <View className="flex-1 items-center justify-center">
            <Spinner />
          </View>
        }
        isEmpty={!!error}
        empty={
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Icon as={TriangleAlert} />
              </EmptyMedia>
              <EmptyTitle>Can&apos;t open this group</EmptyTitle>
              <EmptyDescription>{error?.message}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        }
      >
        {group && (
          <>
            <BalanceSummary
              netMinor={group.myNetMinor}
              currency={group.currency}
            />

            <ExpenseList groupId={group.id} currency={group.currency} />
          </>
        )}
      </RefetchScroll>
    </>
  );
}
