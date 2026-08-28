import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SUPPORTED_CURRENCIES, type CurrencyCode } from "@budget/shared";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type CurrencyPickerProps = {
  value: CurrencyCode;
  onChange: (currency: CurrencyCode) => void;
  disabled?: boolean;
};

function labelFor(code: CurrencyCode) {
  const currency = SUPPORTED_CURRENCIES.find(
    (supported) => supported.code === code,
  );

  return currency ? `${currency.code} · ${currency.name}` : code;
}

/**
 * A group's currency is fixed for all of its expenses, so it is picked once at
 * creation from the list the API accepts.
 */
export function CurrencyPicker({
  value,
  onChange,
  disabled,
}: CurrencyPickerProps) {
  const insets = useSafeAreaInsets();

  const contentInsets = {
    top: insets.top,
    bottom: insets.bottom,
    left: 16,
    right: 16,
  };

  return (
    <Select
      value={{ value, label: labelFor(value) }}
      onValueChange={(option) => {
        if (option) onChange(option.value as CurrencyCode);
      }}
    >
      <SelectTrigger disabled={disabled} accessibilityLabel="Currency">
        <SelectValue placeholder="Select a currency" />
      </SelectTrigger>

      <SelectContent insets={contentInsets} className="w-full">
        {SUPPORTED_CURRENCIES.map((currency) => (
          <SelectItem
            key={currency.code}
            value={currency.code}
            label={`${currency.code} · ${currency.name}`}
          />
        ))}
      </SelectContent>
    </Select>
  );
}
