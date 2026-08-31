import {
  Section,
  SectionContent,
  SectionItem,
  SectionItemContent,
  SectionItemTitle,
} from "@/components/section";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { Check } from "lucide-react-native";
import { View } from "react-native";

type Member = {
  id: string;
  name: string;
};

type ParticipantTogglesProps = {
  members: Member[];
  selectedIds: string[];
  onToggle: (userId: string) => void;
  onSelectAll: () => void;
  currentUserId?: string;
};

export function ParticipantToggles({
  members,
  selectedIds,
  onToggle,
  onSelectAll,
  currentUserId,
}: ParticipantTogglesProps) {
  const allSelected = selectedIds.length === members.length;

  return (
    <Section>
      <SectionContent>
        {members.map((member) => {
          const selected = selectedIds.includes(member.id);

          return (
            <SectionItem
              key={member.id}
              onPress={() => onToggle(member.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
            >
              <SectionItemTitle
                className={selected ? undefined : "text-muted-foreground"}
              >
                {member.id === currentUserId ? "You" : member.name}
              </SectionItemTitle>
              <SectionItemContent>
                <View className="size-5 items-center justify-center">
                  {selected && <Icon as={Check} className="text-primary" />}
                </View>
              </SectionItemContent>
            </SectionItem>
          );
        })}
      </SectionContent>

      {!allSelected && (
        <Button variant="ghost" size="sm" onPress={onSelectAll}>
          <Text>Select everyone</Text>
        </Button>
      )}
    </Section>
  );
}
