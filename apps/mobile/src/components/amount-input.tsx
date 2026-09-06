import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { digitsToMinor, formatAmount } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useRef } from "react";
import { Pressable, View, type TextInput } from "react-native";

type AmountInputProps = {
  /** Minor units: cents for USD, whole yen for JPY. Undefined shows the placeholder. */
  valueMinor: number | undefined;
  onChangeMinor: (minor: number | undefined) => void;
  currency: string;
  autoFocus?: boolean;
  accessibilityLabel?: string;
  className?: string;
};

/**
 * The digits fill in from the right: 1, 2, 3, 4 gives $0.01, $0.12, $1.23,
 * $12.34. To get $12.00, type 1200. The field is undefined until a digit above
 * zero is typed, and goes back to undefined when the digits are deleted.
 */
export function AmountInput({
  valueMinor,
  onChangeMinor,
  currency,
  autoFocus,
  accessibilityLabel,
  className,
}: AmountInputProps) {
  const input = useRef<TextInput>(null);

  const isEmpty = valueMinor === undefined;
  const formatted = formatAmount(valueMinor ?? 0, currency);

  return (
    <View className={cn("relative", className)}>
      {/*
       * The native text view paints each keystroke before the formatted value
       * gets back to it, which shows as a jump. Keep its own text transparent
       * and draw the value in the overlay below. The text stays the formatted
       * value so the caret sits where the overlay ends.
       */}
      <Input
        ref={input}
        value={isEmpty ? "" : formatted}
        onChangeText={(text) => {
          const minor = digitsToMinor(text);

          onChangeMinor(minor === 0 ? undefined : minor);
        }}
        keyboardType="number-pad"
        autoFocus={autoFocus}
        accessibilityLabel={accessibilityLabel}
        className="text-right text-transparent h-18 text-4xl"
      />

      {/*
       * The overlay takes the taps, so a tap can only focus the field. It can
       * not put the caret in the middle of the amount, where a backspace would
       * hit a separator and do nothing.
       */}
      <Pressable
        accessible={false}
        onPress={() => input.current?.focus()}
        className="absolute inset-0 flex-row items-center justify-end px-3"
      >
        <Text
          className={cn(
            "text-4xl font-bold",
            isEmpty && "text-muted-foreground/50",
          )}
        >
          {formatted}
        </Text>
      </Pressable>
    </View>
  );
}
