import { Spinner } from "@/components/ui/spinner";
import { View } from "react-native";

/** Next-page spinner. Failures are silent here — pull-to-refresh retries. */
export function TransactionListFooter({
  isFetchingNextPage,
}: {
  isFetchingNextPage: boolean;
}) {
  if (!isFetchingNextPage) return null;

  return (
    <View className="items-center py-6">
      <Spinner className="text-muted-foreground" />
    </View>
  );
}
