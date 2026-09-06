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
import { cn, formatDate } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { View } from "react-native";

type PaymentListProps = {
  groupId: string;
  currency: string;
  currentUserId?: string;
  limit?: number;
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

/**
 * Green when the money came to the user, red when it left them. A payment
 * between two other members gets no class, so the color of the caller stays.
 */
function amountToneClass(
  payment: { from: { id: string }; to: { id: string } },
  currentUserId?: string,
) {
  if (payment.to.id === currentUserId) return "text-success";
  if (payment.from.id === currentUserId) return "text-destructive";

  return undefined;
}

/**
 * The payments inside the group. With a `limit` it is a card that shows the
 * newest few and links to the full list. Without one it is the full list, which
 * takes its heading from the screen.
 */
export function PaymentList({
  groupId,
  currency,
  currentUserId,
  limit,
}: PaymentListProps) {
  const trpc = useTRPC();

  const { data: payments } = useQuery(
    trpc.settlements.list.queryOptions({ groupId }),
  );

  return (
    <Section>
      {limit !== undefined && (
        <SectionHeader>
          <SectionTitle>Payments</SectionTitle>
        </SectionHeader>
      )}

      {/* Keep the empty card off the screen while the query runs. */}
      {payments !== undefined &&
        (payments.length === 0 ? (
          <SectionContent>
            <SectionItem className="h-auto">
              <Empty className="my-6">
                <EmptyHeader>
                  <EmptyTitle>Nothing yet</EmptyTitle>
                  <EmptyDescription>
                    Record a payment once someone pays someone back.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Link
                    href={{
                      pathname: "/groups/[groupId]/payments/new",
                      params: { groupId },
                    }}
                    asChild
                  >
                    <Button>
                      <Text>Record a payment</Text>
                    </Button>
                  </Link>
                </EmptyContent>
              </Empty>
            </SectionItem>
          </SectionContent>
        ) : (
          <SectionContent>
            {payments.slice(0, limit).map((payment) => (
              <SectionItem key={payment.id} className="h-auto py-2">
                <View className="flex-1 gap-0.5">
                  <SectionItemTitle>
                    {summaryLine(payment, currentUserId)}
                  </SectionItemTitle>
                </View>
                <SectionItemContent>
                  <View className="items-end gap-0.5">
                    <Text
                      className={cn(
                        "text-sm font-medium",
                        amountToneClass(payment, currentUserId),
                      )}
                    >
                      {formatAmount(payment.amountMinor, currency)}
                    </Text>
                    <Text className="text-muted-foreground text-xs">
                      {formatDate(payment.settledAt)}
                    </Text>
                  </View>
                </SectionItemContent>
              </SectionItem>
            ))}
            {limit !== undefined && payments.length > limit && (
              <Link
                href={{
                  pathname: "/groups/[groupId]/payments",
                  params: { groupId },
                }}
                asChild
              >
                <SectionItem>
                  <SectionItemTitle>See all payments</SectionItemTitle>
                  <SectionItemContent />
                </SectionItem>
              </Link>
            )}
            <Link
              href={{
                pathname: "/groups/[groupId]/payments/new",
                params: { groupId },
              }}
              asChild
            >
              <SectionItem>
                <SectionItemTitle>Record a payment</SectionItemTitle>
                <SectionItemContent />
              </SectionItem>
            </Link>
          </SectionContent>
        ))}
    </Section>
  );
}
