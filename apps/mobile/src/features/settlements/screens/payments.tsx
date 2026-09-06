import { RefetchScroll } from "@/components/refetch-scroll";
import { Spinner } from "@/components/ui/spinner";
import { GroupError } from "@/features/groups/components/group-error";
import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/lib/trpc";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { PaymentList } from "../components/payment-list";

export function Payments() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();

  const {
    data: group,
    error,
    isLoading,
  } = useQuery(trpc.groups.get.queryOptions({ groupId }));

  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: trpc.settlements.list.queryKey({ groupId }),
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
      {group && (
        <PaymentList
          groupId={group.id}
          currency={group.currency}
          currentUserId={session?.user.id}
        />
      )}
    </RefetchScroll>
  );
}
