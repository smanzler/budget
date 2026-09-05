import { Section, SectionContent } from "@/components/section";
import { Text } from "@/components/ui/text";
import { formatAmount } from "@/lib/money";
import { cn } from "@/lib/utils";
import { balanceToneClass } from "../balance";

type BalanceSummaryProps = {
  /** Minor units. Positive means the group owes the user. */
  netMinor: number;
  currency: string;
};

export function BalanceSummary({ netMinor, currency }: BalanceSummaryProps) {
  if (netMinor === 0) {
    return (
      <Section>
        <SectionContent className="items-center py-5">
          <Text className="text-muted-foreground text-sm">
            You&apos;re all settled up
          </Text>
        </SectionContent>
      </Section>
    );
  }

  return (
    <Section>
      <SectionContent className="items-center gap-1 py-4">
        <Text className="text-muted-foreground text-sm">
          {netMinor > 0 ? "You are owed" : "You owe"}
        </Text>
        <Text
          className={cn("text-3xl font-semibold", balanceToneClass(netMinor))}
        >
          {formatAmount(netMinor, currency, { signDisplay: "never" })}
        </Text>
      </SectionContent>
    </Section>
  );
}
