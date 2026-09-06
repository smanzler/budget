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
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Text } from "@/components/ui/text";
import { formatAmount } from "@/lib/money";
import { useTRPC } from "@/lib/trpc";
import { formatDate } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { View } from "react-native";

type ExpenseListProps = {
  groupId: string;
  currency: string;
  limit?: number;
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

/**
 * The expenses of the group. With a `limit` it is a card that shows the newest
 * few and links to the full list. Without one it is the full list, which takes
 * its heading from the screen.
 */
export function ExpenseList({ groupId, currency, limit }: ExpenseListProps) {
  const trpc = useTRPC();

  const { data: expenses } = useQuery(
    trpc.expenses.list.queryOptions({ groupId }),
  );

  return (
    <Section>
      {limit !== undefined && (
        <SectionHeader>
          <SectionTitle>Expenses</SectionTitle>
        </SectionHeader>
      )}

      {/* Keep the empty card off the screen while the query runs. */}
      {expenses !== undefined &&
        (expenses.length === 0 ? (
          <SectionContent>
            <SectionItem className="h-auto">
              <Empty className="my-6">
                <EmptyHeader>
                  <EmptyTitle>Nothing yet</EmptyTitle>
                  <EmptyDescription>
                    Add the first shared cost.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Link
                    href={{
                      pathname: "/groups/[groupId]/expenses/new",
                      params: { groupId },
                    }}
                    asChild
                  >
                    <Button>
                      <Text>Add expense</Text>
                    </Button>
                  </Link>
                </EmptyContent>
              </Empty>
            </SectionItem>
          </SectionContent>
        ) : (
          <SectionContent>
            {expenses.slice(0, limit).map((expense) => (
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
            {limit !== undefined && expenses.length > limit && (
              <Link
                href={{
                  pathname: "/groups/[groupId]/expenses",
                  params: { groupId },
                }}
                asChild
              >
                <SectionItem>
                  <SectionItemTitle>See all expenses</SectionItemTitle>
                  <SectionItemContent />
                </SectionItem>
              </Link>
            )}
            <Link
              href={{
                pathname: "/groups/[groupId]/expenses/new",
                params: { groupId },
              }}
              asChild
            >
              <SectionItem>
                <SectionItemTitle>Add expense</SectionItemTitle>
                <SectionItemContent />
              </SectionItem>
            </Link>
          </SectionContent>
        ))}
    </Section>
  );
}
