import { AmountInput } from "@/components/amount-input";
import { MemberSelect } from "@/components/member-select";
import { BodyScrollView } from "@/components/ui/body-scroll-view";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { authClient } from "@/lib/auth-client";
import { formatAmount } from "@/lib/money";
import { useTRPC } from "@/lib/trpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, View } from "react-native";
import { DirectionToggle } from "../components/direction-toggle";
import { parseDirection } from "../direction";

/** The link can carry a suggested amount. Anything else starts empty. */
function initialAmount(value: string | undefined) {
  const amountMinor = Number(value);

  return Number.isSafeInteger(amountMinor) && amountMinor > 0
    ? amountMinor
    : undefined;
}

export function RecordPayment() {
  const params = useLocalSearchParams<{
    groupId: string;
    withUserId?: string;
    direction?: string;
    amountMinor?: string;
  }>();
  const { groupId } = params;
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const currentUserId = session?.user.id;

  const { data: group, error } = useQuery(
    trpc.groups.get.queryOptions({ groupId }),
  );

  const [direction, setDirection] = useState(parseDirection(params.direction));
  const [otherUserId, setOtherUserId] = useState(params.withUserId ?? null);
  const [amountMinor, setAmountMinor] = useState(
    initialAmount(params.amountMinor),
  );

  const createSettlement = useMutation(
    trpc.settlements.create.mutationOptions({
      onSuccess: async () => {
        // A payment moves the balances on both group screens.
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: trpc.settlements.list.queryKey({ groupId }),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.groups.get.queryKey({ groupId }),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.groups.list.queryKey(),
          }),
        ]);

        router.back();
      },
    }),
  );

  if (!group) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        {error ? (
          <Text className="text-destructive text-center text-sm">
            {error.message}
          </Text>
        ) : (
          <Spinner />
        )}
      </View>
    );
  }

  const { currency } = group;
  const others = group.members.filter((member) => member.id !== currentUserId);
  const other = otherUserId ?? others[0]?.id ?? "";
  const otherName =
    others.find((member) => member.id === other)?.name ?? "them";

  const amount = amountMinor ?? 0;
  const formatted = formatAmount(amount, currency);
  const preview =
    direction === "pay"
      ? `You paid ${otherName} ${formatted}`
      : `${otherName} paid you ${formatted}`;

  const canSubmit =
    currentUserId !== undefined &&
    other.length > 0 &&
    amount > 0 &&
    !createSettlement.isPending;

  return (
    <KeyboardAvoidingView className="flex-1">
      <BodyScrollView contentContainerClassName="gap-6">
        {others.length === 0 ? (
          <Text className="text-muted-foreground text-center text-sm">
            Invite someone to the group before you record a payment.
          </Text>
        ) : (
          <>
            <FieldGroup>
              <Field className="gap-1">
                <FieldLabel>Amount</FieldLabel>
                <AmountInput
                  valueMinor={amountMinor}
                  onChangeMinor={setAmountMinor}
                  currency={currency}
                  accessibilityLabel="Amount"
                  autoFocus
                />
                {amount > 0 && <FieldDescription>{preview}</FieldDescription>}
              </Field>

              <Field className="gap-2">
                <FieldLabel>Direction</FieldLabel>
                <DirectionToggle
                  value={direction}
                  onChange={setDirection}
                  disabled={createSettlement.isPending}
                />
              </Field>

              <Field className="gap-1">
                <FieldLabel>
                  {direction === "pay" ? "Paid to" : "Paid by"}
                </FieldLabel>
                <MemberSelect
                  members={others}
                  value={other}
                  onChange={setOtherUserId}
                  placeholder="Who was it?"
                  accessibilityLabel={
                    direction === "pay" ? "Paid to" : "Paid by"
                  }
                  disabled={createSettlement.isPending}
                />
              </Field>
            </FieldGroup>

            {createSettlement.error && (
              <Text className="text-destructive text-center text-sm">
                {createSettlement.error.message}
              </Text>
            )}

            <Button
              disabled={!canSubmit}
              onPress={() => {
                if (!currentUserId) return;

                createSettlement.mutate({
                  groupId,
                  fromUserId: direction === "pay" ? currentUserId : other,
                  toUserId: direction === "pay" ? other : currentUserId,
                  amountMinor: amount,
                });
              }}
            >
              {createSettlement.isPending && (
                <Spinner className="text-secondary" />
              )}
              <Text>Record payment</Text>
            </Button>
          </>
        )}
      </BodyScrollView>
    </KeyboardAvoidingView>
  );
}
