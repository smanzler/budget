import { SectionItem } from "@/components/section";
import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { View } from "react-native";
import {
  formatAccountLabel,
  formatCategory,
  formatTransactionAmount,
} from "../lib/format";
import type { Transaction } from "../lib/group";
import { MerchantLogo } from "./merchant-logo";

/**
 * A `SectionItem` with the card-edge flags passed explicitly.
 *
 * `SectionContent` normally injects them by mapping over its children, which
 * virtualization makes impossible — the SectionList only ever renders one row
 * at a time, so it computes the flags from the item's index instead.
 */
export function TransactionRow({
  transaction,
  isFirst,
  isLast,
}: {
  transaction: Transaction;
  isFirst: boolean;
  isLast: boolean;
}) {
  const { text, isInflow } = formatTransactionAmount(
    transaction.amount,
    transaction.isoCurrencyCode,
  );

  const category = formatCategory(transaction.category);
  const subtitle = [
    category,
    formatAccountLabel(transaction.accountName, transaction.accountMask),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    // h-auto overrides SectionItem's h-11 — these rows are two lines tall.
    <SectionItem isFirst={isFirst} isLast={isLast} className="h-auto py-2.5">
      <MerchantLogo
        logoUrl={transaction.logoUrl}
        category={transaction.category}
      />

      <View className="min-w-0 flex-1 gap-0.5">
        <Text numberOfLines={1} className="font-medium">
          {transaction.merchantName ?? transaction.name}
        </Text>

        <View className="flex-row items-center gap-1.5">
          <Text
            numberOfLines={1}
            className="text-muted-foreground shrink text-xs"
          >
            {subtitle}
          </Text>
          {transaction.pending ? (
            <Badge variant="secondary" className="px-1.5 py-0">
              <Text className="text-[10px]">Pending</Text>
            </Badge>
          ) : null}
        </View>
      </View>

      {/* Only inflows get color — tinting every purchase red is noise in a
          ledger that is almost entirely debits. */}
      <Text
        className={cn(
          "font-medium tabular-nums",
          isInflow && "text-success",
          transaction.pending && "opacity-60",
        )}
      >
        {text}
      </Text>
    </SectionItem>
  );
}
