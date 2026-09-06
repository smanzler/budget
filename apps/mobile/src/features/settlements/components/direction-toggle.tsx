import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { View } from "react-native";
import type { Direction } from "../direction";

type DirectionToggleProps = {
  value: Direction;
  onChange: (direction: Direction) => void;
  disabled?: boolean;
};

const OPTIONS: { direction: Direction; label: string }[] = [
  { direction: "pay", label: "You paid" },
  { direction: "receive", label: "You were paid" },
];

export function DirectionToggle({
  value,
  onChange,
  disabled,
}: DirectionToggleProps) {
  return (
    <View className="flex-row gap-2">
      {OPTIONS.map((option) => (
        <Button
          key={option.direction}
          className="flex-1"
          variant={value === option.direction ? "default" : "outline"}
          disabled={disabled}
          onPress={() => onChange(option.direction)}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === option.direction }}
        >
          <Text>{option.label}</Text>
        </Button>
      ))}
    </View>
  );
}
