import { RefetchScroll } from "@/components/refetch-scroll";
import {
  Section,
  SectionContent,
  SectionItem,
  SectionItemContent,
  SectionItemTitle,
  SectionTitle,
} from "@/components/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { UserAvatar } from "@/components/user-avatar";
import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/lib/trpc";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { UserPlus } from "lucide-react-native";
import { View } from "react-native";
import { GroupError } from "../components/group-error";
import { InviteDialog } from "../components/invite-dialog";
import { LeaveGroupDialog } from "../components/leave-group-dialog";
import { MemberBalance } from "../components/member-balance";
import { RenameGroupDialog } from "../components/rename-group-dialog";

export function GroupSettings() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const trpc = useTRPC();
  const { data: session } = authClient.useSession();

  const {
    data: group,
    error,
    isLoading,
    refetch,
  } = useQuery(trpc.groups.get.queryOptions({ groupId }));

  return (
    <RefetchScroll
      refetch={refetch}
      isLoading={isLoading}
      loading={
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      }
      isEmpty={!!error}
      empty={<GroupError message={error?.message} />}
    >
      {group && (
        <>
          <Section>
            <SectionTitle>
              {group.members.length === 1
                ? "1 member"
                : `${group.members.length} members`}
            </SectionTitle>
            <SectionContent>
              {group.members.map((member) => (
                <SectionItem key={member.id} className="h-auto py-2">
                  <UserAvatar name={member.name} image={member.image} />
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
              <InviteDialog groupId={group.id} groupName={group.name}>
                <SectionItem className="justify-center">
                  <Icon as={UserPlus} />
                  <SectionItemTitle>Invite people</SectionItemTitle>
                </SectionItem>
              </InviteDialog>
            </SectionContent>
          </Section>

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
  );
}
