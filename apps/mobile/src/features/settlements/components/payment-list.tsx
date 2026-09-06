import {
  Section,
  SectionContent,
  SectionHeader,
  SectionItem,
  SectionItemContent,
  SectionItemTitle,
  SectionTitle,
} from "@/components/section";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { formatAmount } from "@/lib/money";
import { useTRPC } from "@/lib/trpc";
import { formatDate } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { View } from "react-native";

type PaymentListProps = {
  groupId: string;
  currency: string;
  currentUserId?: string;
};

function summaryLine(
  payment: {
    from: { id: string; name: string };
    to: { id: string; name: string };
  },
  currentUserId?: string,
) {
  const payer = payment.from.id === currentUserId ? "You" : payment.from.name;
  const receiver = payment.to.id === currentUserId ? "you" : payment.to.name;

  return `${payer} paid ${receiver}`;
}

export function PaymentList({
  groupId,
  currency,
  currentUserId,
}: PaymentListProps) {
  const trpc = useTRPC();

  const { data: payments } = useQuery(
    trpc.settlements.list.queryOptions({ groupId }),
  );

  return (
    <Section>
      <SectionHeader className="flex-row items-center justify-between">
        <SectionTitle>Payments</SectionTitle>
        <Link
          href={{ pathname: "/groups/[groupId]/settle", params: { groupId } }}
          asChild
        >
          <Button variant="outline" size="sm">
            <Text>Record a payment</Text>
          </Button>
        </Link>
      </SectionHeader>

      {/* Keep the empty card off the screen while the query runs. */}
      {payments !== undefined &&
        (payments.length === 0 ? (
          <Text className="text-muted-foreground text-sm">
            Nothing yet. Record a payment once someone pays someone back.
          </Text>
        ) : (
          <SectionContent>
            {payments.map((payment) => (
              <SectionItem key={payment.id} className="h-auto py-2">
                <View className="flex-1 gap-0.5">
                  <SectionItemTitle>
                    {summaryLine(payment, currentUserId)}
                  </SectionItemTitle>
                  <Text className="text-muted-foreground text-xs">
                    {formatDate(payment.settledAt)}
                  </Text>
                </View>
                <SectionItemContent>
                  <Text className="text-sm font-medium">
                    {formatAmount(payment.amountMinor, currency)}
                  </Text>
                </SectionItemContent>
              </SectionItem>
            ))}
          </SectionContent>
        ))}
    </Section>
  );
}
