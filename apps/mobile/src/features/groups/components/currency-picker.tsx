import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { SUPPORTED_CURRENCIES, type CurrencyCode } from "@budget/shared";
import { View } from "react-native";

type CurrencyPickerProps = {
  value: CurrencyCode;
  onChange: (currency: CurrencyCode) => void;
  disabled?: boolean;
};

/**
 * A group's currency is fixed for all of its expenses, so it is picked once at
 * creation from the list the API accepts.
 */
export function CurrencyPicker({
  value,
  onChange,
  disabled,
}: CurrencyPickerProps) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {SUPPORTED_CURRENCIES.map((currency) => {
        const selected = currency.code === value;

        return (
          <Button
            key={currency.code}
            size="sm"
            variant={selected ? "default" : "outline"}
            disabled={disabled}
            onPress={() => onChange(currency.code)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={currency.name}
          >
            <Text>{currency.code}</Text>
          </Button>
        );
      })}
    </View>
  );
}
