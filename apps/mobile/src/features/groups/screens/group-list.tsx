import { RefetchScroll } from "@/components/refetch-scroll";
import {
  Section,
  SectionContent,
  SectionItem,
  SectionItemContent,
  SectionItemTitle,
} from "@/components/section";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { formatAmount } from "@/lib/money";
import { useTRPC } from "@/lib/trpc";
import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { Users } from "lucide-react-native";
import { View } from "react-native";
import { balanceToneClass } from "../balance";

function memberLabel(count: number) {
  return count === 1 ? "1 member" : `${count} members`;
}

function balanceLabel(netMinor: number, currency: string) {
  if (netMinor === 0) return "settled up";

  const amount = formatAmount(netMinor, currency, { signDisplay: "never" });

  return netMinor > 0 ? `you're owed ${amount}` : `you owe ${amount}`;
}

export function GroupList() {
  const trpc = useTRPC();

  const {
    data: groups,
    isLoading,
    refetch,
  } = useQuery(trpc.groups.list.queryOptions());

  return (
    <RefetchScroll
      refetch={refetch}
      isLoading={isLoading}
      loading={
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      }
      isEmpty={groups?.length === 0}
      empty={
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Icon as={Users} />
            </EmptyMedia>
            <EmptyTitle>No groups yet</EmptyTitle>
            <EmptyDescription>
              Make a group for a trip, a flat or a night out, then add the
              expenses everyone shares.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link href="/groups/new" asChild>
              <Button className="w-full">
                <Text>Create a group</Text>
              </Button>
            </Link>
            <Link href="/groups/join" asChild>
              <Button className="w-full" variant="outline">
                <Text>Join with a code</Text>
              </Button>
            </Link>
          </EmptyContent>
        </Empty>
      }
    >
      <Section>
        <SectionContent>
          {groups?.map((group) => (
            <Link
              key={group.id}
              href={{
                pathname: "/groups/[groupId]",
                params: { groupId: group.id },
              }}
              asChild
            >
              <SectionItem className="h-auto py-2">
                <View className="flex-1 gap-0.5">
                  <SectionItemTitle>{group.name}</SectionItemTitle>
                  <Text className="text-muted-foreground text-xs">
                    {memberLabel(group.memberCount)}
                  </Text>
                </View>
                <SectionItemContent
                  textClassName={balanceToneClass(group.myNetMinor)}
                >
                  {balanceLabel(group.myNetMinor, group.currency)}
                </SectionItemContent>
              </SectionItem>
            </Link>
          ))}
        </SectionContent>
      </Section>

      <Link href="/groups/join" asChild>
        <Button variant="outline">
          <Text>Join with a code</Text>
        </Button>
      </Link>
    </RefetchScroll>
  );
}
