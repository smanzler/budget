import { RefetchScroll } from "@/components/refetch-scroll";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Icon } from "@/components/ui/icon";
import {
  Section,
  SectionContent,
  SectionItem,
  SectionItemContent,
  SectionItemTitle,
  SectionTitle,
} from "@/components/section";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/lib/trpc";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { TriangleAlert } from "lucide-react-native";
import { View } from "react-native";
import { ExpenseList } from "@/features/expenses/components/expense-list";
import { BalanceSummary } from "../components/balance-summary";
import { InviteButton } from "../components/invite-button";
import { LeaveGroupDialog } from "../components/leave-group-dialog";
import { MemberBalance } from "../components/member-balance";
import { RenameGroupDialog } from "../components/rename-group-dialog";

function initialsOf(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function GroupDetail() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();

  const {
    data: group,
    error,
    isLoading,
    refetch,
  } = useQuery(trpc.groups.get.queryOptions({ groupId }));

  // The expense list has its own query. Refresh it with the group.
  const refresh = () =>
    Promise.all([
      refetch(),
      queryClient.invalidateQueries({
        queryKey: trpc.expenses.list.queryKey({ groupId }),
      }),
    ]);

  return (
    <>
      <Stack.Screen options={{ title: group?.name ?? "Group" }} />

      <RefetchScroll
        refetch={refresh}
        isLoading={isLoading}
        loading={
          <View className="flex-1 items-center justify-center">
            <Spinner />
          </View>
        }
        isEmpty={!!error}
        empty={
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Icon as={TriangleAlert} />
              </EmptyMedia>
              <EmptyTitle>Can&apos;t open this group</EmptyTitle>
              <EmptyDescription>{error?.message}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        }
      >
        {group && (
          <>
            <BalanceSummary
              netMinor={group.myNetMinor}
              currency={group.currency}
            />

            <ExpenseList groupId={group.id} currency={group.currency} />

            <Section>
              <SectionTitle>
                {group.members.length === 1
                  ? "1 member"
                  : `${group.members.length} members`}
              </SectionTitle>
              <SectionContent>
                {group.members.map((member) => (
                  <SectionItem key={member.id} className="h-auto py-2">
                    <Avatar alt={member.name}>
                      {member.image ? (
                        <AvatarImage source={{ uri: member.image }} />
                      ) : null}
                      <AvatarFallback>
                        <Text className="text-xs">
                          {initialsOf(member.name)}
                        </Text>
                      </AvatarFallback>
                    </Avatar>
                    <View className="flex-1 gap-0.5">
                      <View className="flex-row items-center gap-2">
                        <SectionItemTitle>{member.name}</SectionItemTitle>
                        {member.id === session?.user.id && (
                          <Badge variant="secondary">
                            <Text>You</Text>
                          </Badge>
                        )}
                      </View>
                      <Text
                        className="text-muted-foreground text-xs"
                        numberOfLines={1}
                      >
                        {member.email}
                      </Text>
                    </View>
                    <SectionItemContent>
                      <MemberBalance
                        netMinor={member.netMinor}
                        currency={group.currency}
                      />
                    </SectionItemContent>
                  </SectionItem>
                ))}
              </SectionContent>
            </Section>

            <InviteButton groupId={group.id} groupName={group.name} />

            <Section>
              <SectionContent>
                <RenameGroupDialog groupId={group.id} currentName={group.name}>
                  <SectionItem>
                    <SectionItemTitle>Rename group</SectionItemTitle>
                    <SectionItemContent>{group.name}</SectionItemContent>
                  </SectionItem>
                </RenameGroupDialog>
                <SectionItem>
                  <SectionItemTitle>Currency</SectionItemTitle>
                  <SectionItemContent>
                    <Text className="text-muted-foreground text-sm">
                      {group.currency}
                    </Text>
                  </SectionItemContent>
                </SectionItem>
              </SectionContent>
            </Section>

            <LeaveGroupDialog groupId={group.id} groupName={group.name}>
              <Button variant="outline">
                <Text className="text-destructive">Leave group</Text>
              </Button>
            </LeaveGroupDialog>
          </>
        )}
      </RefetchScroll>
    </>
  );
}
