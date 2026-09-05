import { Text } from "@/components/ui/text";
import { formatAmount } from "@/lib/money";
import { cn } from "@/lib/utils";
import { View } from "react-native";
import { balanceToneClass } from "../balance";

type MemberBalanceProps = {
  /** Minor units. Positive means the group owes the member. */
  netMinor: number;
  currency: string;
};

export function MemberBalance({ netMinor, currency }: MemberBalanceProps) {
  if (netMinor === 0) {
    return <Text className="text-muted-foreground text-xs">settled up</Text>;
  }

  return (
    <View className="items-end gap-0.5">
      <Text className={cn("text-sm font-medium", balanceToneClass(netMinor))}>
        {formatAmount(netMinor, currency, { signDisplay: "never" })}
      </Text>
      <Text className="text-muted-foreground text-xs">
        {netMinor > 0 ? "is owed" : "owes"}
      </Text>
    </View>
  );
}
