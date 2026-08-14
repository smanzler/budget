import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";
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
import type { Member } from "@/features/household/hooks/use-household";
import { RefreshCw, Trash2 } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { usePlaidLink } from "../hooks/use-plaid-link";
import {
  formatAccountBalance,
  formatAccountSubtitle,
  type BankAccount,
  type PlaidItem,
} from "../lib/format";
import { ItemStatusBadge } from "./item-status-badge";

export function InstitutionSection({
  item,
  members,
  onDisconnect,
  onEditAccount,
}: {
  item: PlaidItem;
  /**
   * The household's seats. One of them means nobody to split with, and every
   * ownership chip below disappears — a solo user gets the same rows as before
   * any of this existed.
   */
  members: Member[];
  onDisconnect: (item: PlaidItem) => void;
  onEditAccount: (account: BankAccount) => void;
}) {
  // Same hook as the connect button; passing an itemId makes it update mode.
  const link = usePlaidLink();
  const needsReconnect = item.status === "login_required";
  const isShared = members.length > 1;

  return (
    <Section>
      <SectionHeader className="flex-row items-center justify-between">
        <SectionTitle>{item.institutionName ?? "Bank"}</SectionTitle>
        <ItemStatusBadge status={item.status} />
      </SectionHeader>

      <SectionContent>
        {item.accounts.map((account) => {
          const balance = formatAccountBalance(account);
          const owner = members.find(
            (member) => member.id === account.ownerMemberId,
          );

          return (
            // h-auto because SectionItem hard-codes h-11 and these are two-line.
            <SectionItem key={account.id} className="h-auto py-2">
              <View className="min-w-0 flex-1 gap-0.5">
                <Text numberOfLines={1} className="font-medium">
                  {account.name}
                </Text>

                <View className="flex-row items-center gap-1.5">
                  <Text
                    numberOfLines={1}
                    className="text-muted-foreground shrink text-xs"
                  >
                    {formatAccountSubtitle(account)}
                  </Text>

                  {/* Pushed to the end of the subtitle line rather than under
                      the balance: a credit card already spends that column on
                      its "Owed" caption. */}
                  {isShared ? (
                    <Pressable
                      className="ml-auto shrink-0"
                      hitSlop={8}
                      accessibilityLabel={`Sharing settings for ${account.name}`}
                      onPress={() => onEditAccount(account)}
                    >
                      <Badge variant="secondary" className="px-1.5 py-0">
                        <Text className="text-[10px]">
                          {owner?.displayName ?? "Former member"} ·{" "}
                          {account.isPrivate ? "Private" : "Shared"}
                        </Text>
                      </Badge>
                    </Pressable>
                  ) : null}
                </View>
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
