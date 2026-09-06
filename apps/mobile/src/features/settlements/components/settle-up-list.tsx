import {
  Section,
  SectionContent,
  SectionItem,
  SectionItemContent,
  SectionItemTitle,
  SectionTitle,
} from "@/components/section";
import { formatAmount } from "@/lib/money";
import { Link } from "expo-router";
import { balanceToneClass } from "@/features/groups/balance";

type SuggestedPayment = {
  fromUserId: string;
  toUserId: string;
  amountMinor: number;
};

type SettleUpListProps = {
  groupId: string;
  currency: string;
  members: { id: string; name: string }[];
  suggestedPayments: SuggestedPayment[];
  currentUserId?: string;
};

export function SettleUpList({
  groupId,
  currency,
  members,
  suggestedPayments,
  currentUserId,
}: SettleUpListProps) {
  const mine = suggestedPayments.filter(
    (payment) =>
      payment.fromUserId === currentUserId ||
      payment.toUserId === currentUserId,
  );

  if (mine.length === 0) return null;

  return (
    <Section>
      <SectionTitle>Settle up</SectionTitle>

      <SectionContent>
        {mine.map((payment) => {
          const isPayer = payment.fromUserId === currentUserId;
          const otherId = isPayer ? payment.toUserId : payment.fromUserId;
          const other = members.find((member) => member.id === otherId);

          return (
            <Link
              key={`${payment.fromUserId}-${payment.toUserId}`}
              href={{
                pathname: "/groups/[groupId]/settle",
                params: {
                  groupId,
                  withUserId: otherId,
                  direction: isPayer ? "pay" : "receive",
                  amountMinor: payment.amountMinor,
                },
              }}
              asChild
            >
              <SectionItem>
                <SectionItemTitle>
                  {isPayer
                    ? `Pay ${other?.name ?? "them"}`
                    : `${other?.name ?? "They"} pays you`}
                </SectionItemTitle>
                <SectionItemContent
                  textClassName={balanceToneClass(
                    isPayer ? -payment.amountMinor : payment.amountMinor,
                  )}
                >
                  {formatAmount(payment.amountMinor, currency)}
                </SectionItemContent>
              </SectionItem>
            </Link>
          );
        })}
      </SectionContent>
    </Section>
  );
}
