import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Member = {
  id: string;
  name: string;
};

type PayerSelectProps = {
  members: Member[];
  value: string;
  onChange: (userId: string) => void;
  /** The row of this user reads "You". */
  currentUserId?: string;
  disabled?: boolean;
};

function labelFor(member: Member, currentUserId?: string) {
  return member.id === currentUserId ? "You" : member.name;
}

export function PayerSelect({
  members,
  value,
  onChange,
  currentUserId,
  disabled,
}: PayerSelectProps) {
  const insets = useSafeAreaInsets();

  const selected = members.find((member) => member.id === value);

  return (
    <Select
      value={
        selected
          ? { value: selected.id, label: labelFor(selected, currentUserId) }
          : undefined
      }
      onValueChange={(option) => {
        if (option) onChange(option.value);
      }}
    >
      <SelectTrigger disabled={disabled} accessibilityLabel="Paid by">
        <SelectValue placeholder="Who paid?" />
      </SelectTrigger>

      <SelectContent
        insets={{ top: insets.top, bottom: insets.bottom, left: 16, right: 16 }}
        className="w-full"
      >
        {members.map((member) => (
          <SelectItem
            key={member.id}
            value={member.id}
            label={labelFor(member, currentUserId)}
          />
        ))}
      </SelectContent>
    </Select>
  );
}
