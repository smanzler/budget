import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import {
  Section,
  SectionContent,
  SectionHeader,
  SectionItem,
  SectionItemContent,
  SectionTitle,
} from "@/components/section";
import { RefreshCw, Trash2 } from "lucide-react-native";
import { View } from "react-native";
import { usePlaidLink } from "../hooks/use-plaid-link";
import {
  formatAccountBalance,
  formatAccountSubtitle,
  type PlaidItem,
} from "../lib/format";
import { ItemStatusBadge } from "./item-status-badge";

export function InstitutionSection({
  item,
  onDisconnect,
}: {
  item: PlaidItem;
  onDisconnect: (item: PlaidItem) => void;
}) {
  // Same hook as the connect button; passing an itemId makes it update mode.
  const link = usePlaidLink();
  const needsReconnect = item.status === "login_required";

  return (
    <Section>
      <SectionHeader className="flex-row items-center justify-between">
        <SectionTitle>{item.institutionName ?? "Bank"}</SectionTitle>
        <ItemStatusBadge status={item.status} />
      </SectionHeader>

      <SectionContent>
        {item.accounts.map((account) => {
          const balance = formatAccountBalance(account);

          return (
            // h-auto because SectionItem hard-codes h-11 and these are two-line.
            <SectionItem key={account.id} className="h-auto py-2">
              <View className="min-w-0 flex-1 gap-0.5">
                <Text numberOfLines={1} className="font-medium">
                  {account.name}
                </Text>
                <Text
                  numberOfLines={1}
                  className="text-muted-foreground text-xs"
                >
                  {formatAccountSubtitle(account)}
                </Text>
              </View>

              {/* An element, not a string — a string makes SectionItemContent
                  render a chevron, and a balance is not navigation. */}
              <SectionItemContent>
                <View className="items-end">
                  <Text className="font-medium tabular-nums">
                    {balance.text}
                  </Text>
                  {balance.caption ? (
                    <Text className="text-muted-foreground text-[10px]">
                      {balance.caption}
                    </Text>
                  ) : null}
                </View>
              </SectionItemContent>
            </SectionItem>
          );
        })}

        {needsReconnect ? (
          <SectionItem
            onPress={() => void link.open(item.id)}
            className="h-auto py-2.5"
          >
            <Icon as={RefreshCw} className="text-foreground size-4" />
            <Text className="font-medium">Reconnect</Text>
            {link.isPending ? (
              <View className="ml-auto">
                <Spinner className="text-muted-foreground" />
              </View>
            ) : null}
          </SectionItem>
        ) : null}

        <SectionItem
          onPress={() => onDisconnect(item)}
          className="h-auto py-2.5"
        >
          <Icon as={Trash2} className="text-destructive size-4" />
          <Text className="text-destructive font-medium">Disconnect</Text>
        </SectionItem>
      </SectionContent>

      {link.error ? (
        <Text className="text-destructive text-sm">{link.error}</Text>
      ) : null}
    </Section>
  );
}
