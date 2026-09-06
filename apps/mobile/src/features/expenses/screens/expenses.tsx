import { RefetchScroll } from "@/components/refetch-scroll";
import { Spinner } from "@/components/ui/spinner";
import { GroupError } from "@/features/groups/components/group-error";
import { useTRPC } from "@/lib/trpc";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { ExpenseList } from "../components/expense-list";

export function Expenses() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const {
    data: group,
    error,
    isLoading,
  } = useQuery(trpc.groups.get.queryOptions({ groupId }));

  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: trpc.expenses.list.queryKey({ groupId }),
    });

  return (
    <RefetchScroll
      refetch={refresh}
      isLoading={isLoading}
      loading={
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      }
      isEmpty={!!error}
      empty={<GroupError message={error?.message} />}
    >
      {group && <ExpenseList groupId={group.id} currency={group.currency} />}
    </RefetchScroll>
  );
}
