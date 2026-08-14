import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { fromCents } from "@budget/shared";
import { useState } from "react";
import { View } from "react-native";
import { formatCents, parseAmountCents } from "@/lib/money";
import { newSettlementId, useSettleUp } from "../hooks/use-settle-up";
import { apiErrorMessage } from "../lib/errors";
import { isIsoDate, todayIsoDate } from "../lib/format";

export function SettleUpSheet({
  memberId,
  displayName,
  outstandingCents,
  currency,
  open,
  onOpenChange,
}: {
  memberId: string;
  displayName: string;
  /** What you still owe them, as a positive number. */
  outstandingCents: number;
  currency: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const settle = useSettleUp();

  /**
   * ONE id per opening of the sheet, generated here rather than by the server.
   *
   * It is the idempotency key `settlements.create` dedupes on, so a double-tap
   * — or a TanStack retry of a request that actually succeeded — replays the
   * same id and is a no-op instead of a second repayment. Minting one per
   * render would defeat exactly that, which is why it lives in state and is
   * only rotated once the sheet closes and the payment it names is done with.
   */
  const [settlementId, setSettlementId] = useState(newSettlementId);

  // `null` means "still showing the prefill". The outstanding amount arrives
  // with the balances query and changes after a payment, so it can't be a
  // one-shot useState initial value.
  const [amount, setAmount] = useState<string | null>(null);
  const [settledOn, setSettledOn] = useState(() => todayIsoDate());

  const amountText = amount ?? fromCents(outstandingCents);
  const parsed = parseAmountCents(amountText);
  // A repayment has to actually move money, so zero is as unusable here as a
  // half-typed number — both leave the button disabled rather than sending
  // something the API would only reject.
  const amountCents = parsed !== null && parsed > 0 ? parsed : null;
  const dateIsValid = isIsoDate(settledOn);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setSettlementId(newSettlementId());
      setAmount(null);
      setSettledOn(todayIsoDate());
      settle.reset();
    }

    onOpenChange(next);
  };

  const handleSubmit = async () => {
    if (amountCents === null || !dateIsValid) return;

    try {
      await settle.mutateAsync({
        settlementId,
        toMemberId: memberId,
        amountCents,
        settledOn,
      });
      handleOpenChange(false);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settle up with {displayName}</DialogTitle>
          <DialogDescription>
            This records the payment. It doesn&apos;t move any money.
          </DialogDescription>
        </DialogHeader>

        <View className="gap-4">
          <Field>
            <FieldLabel>Amount</FieldLabel>
            <Input
              value={amountText}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              selectTextOnFocus
            />
            <FieldDescription>
              You owe {displayName} {formatCents(outstandingCents, currency)}.
            </FieldDescription>
            {amountCents === null ? (
              <FieldError>Enter an amount like 12.34.</FieldError>
            ) : null}
          </Field>

          <Field>
            <FieldLabel>Date paid</FieldLabel>
            <Input
              value={settledOn}
              onChangeText={setSettledOn}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {dateIsValid ? null : (
              <FieldError>Use a date like {todayIsoDate()}.</FieldError>
            )}
          </Field>
        </View>

        {settle.isError ? (
          <Text className="text-destructive text-sm">
            {apiErrorMessage(
              settle.error,
              "Couldn't record the payment. Please try again.",
            )}
          </Text>
        ) : null}

        <DialogFooter>
          <Button
            variant="outline"
            disabled={settle.isPending}
            onPress={() => handleOpenChange(false)}
          >
            <Text>Cancel</Text>
          </Button>
          <Button
            disabled={settle.isPending || amountCents === null || !dateIsValid}
            onPress={() => void handleSubmit()}
          >
            {settle.isPending ? (
              <Spinner className="text-primary-foreground" />
            ) : null}
            <Text>Record payment</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
