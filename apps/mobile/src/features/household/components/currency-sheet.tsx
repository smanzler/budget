import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupOption } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { useState } from "react";
import { useHousehold, useSetCurrency } from "../hooks/use-household";
import { apiErrorMessage } from "../lib/errors";

/**
 * The currencies on offer. Deliberately a short list rather than all 180 ISO
 * codes: this is a one-time choice made before anyone has spent anything, and a
 * scrolling wall of codes is a worse way to make it than five taps.
 *
 * `setCurrency` accepts any three-letter code, so nothing here is a ceiling —
 * it is the set worth a row.
 */
export const CURRENCIES = [
  { code: "USD", label: "US dollar", symbol: "$" },
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "GBP", label: "British pound", symbol: "£" },
  { code: "CAD", label: "Canadian dollar", symbol: "$" },
  { code: "AUD", label: "Australian dollar", symbol: "$" },
] as const;

export const currencyLabel = (code: string) =>
  CURRENCIES.find((currency) => currency.code === code)?.label ?? code;

/**
 * Picks the currency every balance in this household is denominated in.
 *
 * Mount this keyed on the current currency so reopening it after a save seeds
 * from the saved value rather than from a stale one.
 */
export function CurrencySheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data } = useHousehold();
  const setCurrency = useSetCurrency();

  const current = data?.defaultCurrency ?? "USD";
  const [selected, setSelected] = useState(current);

  const handleSave = async () => {
    try {
      await setCurrency.mutateAsync({ currency: selected });
      onOpenChange(false);
    } catch (caught) {
      console.error(caught);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Currency</DialogTitle>
          <DialogDescription>
            Every balance and repayment in this household is in this currency,
            and only transactions in it are split automatically. You can change
            it until the first shared expense lands — after that it is fixed.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={selected} onValueChange={setSelected}>
          {CURRENCIES.map((currency) => (
            <RadioGroupOption
              key={currency.code}
              value={currency.code}
              title={currency.code}
              description={`${currency.label} (${currency.symbol})`}
              onSelect={() => setSelected(currency.code)}
            />
          ))}
        </RadioGroup>

        {setCurrency.error ? (
          <Text className="text-destructive text-sm">
            {apiErrorMessage(
              setCurrency.error,
              "Couldn't change the currency. Try again.",
            )}
          </Text>
        ) : null}

        <DialogFooter>
          <Button
            variant="outline"
            disabled={setCurrency.isPending}
            onPress={() => onOpenChange(false)}
          >
            <Text>Cancel</Text>
          </Button>
          <Button
            disabled={setCurrency.isPending || selected === current}
            onPress={() => void handleSave()}
          >
            {setCurrency.isPending ? (
              <Spinner className="text-primary-foreground" />
            ) : null}
            <Text>Save</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
