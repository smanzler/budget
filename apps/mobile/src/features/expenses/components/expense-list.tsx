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
import { useTRPC } from "@/lib/trpc";
import { formatDate } from "@/lib/utils";
import { formatAmount } from "@/lib/money";
import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { View } from "react-native";

type ExpenseListProps = {
  groupId: string;
  currency: string;
};

function summaryLine(
  expense: {
    isPaidByMe: boolean;
    paidBy: { name: string };
    totalMinor: number;
    participantCount: number;
  },
  currency: string,
) {
  const payer = expense.isPaidByMe ? "You paid" : `${expense.paidBy.name} paid`;
  const ways =
    expense.participantCount === 1
      ? "not split"
      : `split ${expense.participantCount} ways`;

  return `${payer} ${formatAmount(expense.totalMinor, currency)} · ${ways}`;
}

export function ExpenseList({ groupId, currency }: ExpenseListProps) {
  const trpc = useTRPC();

  const { data: expenses } = useQuery(
    trpc.expenses.list.queryOptions({ groupId }),
  );

  return (
    <Section>
      <SectionHeader className="flex-row items-center justify-between">
        <SectionTitle>Expenses</SectionTitle>
        <Link
          href={{
            pathname: "/groups/[groupId]/expenses/new",
            params: { groupId },
          }}
          asChild
        >
          <Button variant="outline" size="sm">
            <Text>Add expense</Text>
          </Button>
        </Link>
      </SectionHeader>

      {/* Keep the empty card off the screen while the query runs. */}
      {expenses !== undefined &&
        (expenses.length === 0 ? (
          <Text className="text-muted-foreground text-sm">
            Nothing yet. Add the first shared cost.
          </Text>
        ) : (
          <SectionContent>
            {expenses.map((expense) => (
              <SectionItem key={expense.id} className="h-auto py-2">
                <View className="flex-1 gap-0.5">
                  <SectionItemTitle>{expense.description}</SectionItemTitle>
                  <Text className="text-muted-foreground text-xs">
                    {summaryLine(expense, currency)}
                  </Text>
                </View>
                <SectionItemContent>
                  <View className="items-end gap-0.5">
                    <Text className="text-sm font-medium">
                      {expense.myShareMinor > 0
                        ? formatAmount(expense.myShareMinor, currency)
                        : "—"}
                    </Text>
                    <Text className="text-muted-foreground text-xs">
                      {formatDate(expense.spentAt)}
                    </Text>
                  </View>
                </SectionItemContent>
              </SectionItem>
            ))}
          </SectionContent>
        ))}
    </Section>
  );
}
